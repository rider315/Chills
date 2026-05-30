const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { Resume } = require('../models');
const { parsePDF } = require('../services/fileParser');
const ai = require('../services/ai');

const router = express.Router();

// Configure multer for resume uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `resume-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * POST /api/resume/upload
 * Upload a PDF resume, parse text, then extract structured profile with AI.
 */
router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded. Use field name "resume" with a PDF file.' });
    }

    const fs = require('fs');
    const buffer = fs.readFileSync(req.file.path);

    // Extract text from PDF
    const text = await parsePDF(buffer);
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from the PDF. The file may be image-based or empty.' });
    }

    // Parse resume with AI
    const parsed = await ai.parseResume(text);

    // Upsert resume in database (only keep one resume)
    let resume = await Resume.findOne();
    if (resume) {
      resume.filename = req.file.originalname;
      resume.text = text;
      resume.parsed = parsed;
      resume.uploadedAt = new Date();
      await resume.save();
    } else {
      resume = await Resume.create({
        filename: req.file.originalname,
        text,
        parsed,
        uploadedAt: new Date(),
      });
    }

    return res.status(200).json({
      message: 'Resume uploaded and parsed successfully.',
      resume,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return res.status(500).json({ error: `Failed to process resume: ${error.message}` });
  }
});

/**
 * GET /api/resume
 * Return the current resume data.
 */
router.get('/', async (req, res) => {
  try {
    const resume = await Resume.findOne();

    if (!resume || !resume.filename) {
      return res.status(404).json({ error: 'No resume uploaded yet.' });
    }

    return res.status(200).json({ resume });
  } catch (error) {
    console.error('Get resume error:', error);
    return res.status(500).json({ error: `Failed to retrieve resume: ${error.message}` });
  }
});

/**
 * DELETE /api/resume
 * Clear the resume data.
 */
router.delete('/', async (req, res) => {
  try {
    await Resume.deleteMany({});
    return res.status(200).json({ message: 'Resume data cleared.' });
  } catch (error) {
    console.error('Delete resume error:', error);
    return res.status(500).json({ error: `Failed to clear resume: ${error.message}` });
  }
});

module.exports = router;
