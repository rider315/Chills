const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { Recruiter } = require('../models');
const { parseExcel, parseGoogleSheet } = require('../services/fileParser');

const router = express.Router();

// Configure multer for Excel uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `recruiters-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed.'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * POST /api/recruiters/manual
 * Add a single recruiter manually.
 */
router.post('/manual', async (req, res) => {
  try {
    const { email, company, recruiterName } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    // Check for duplicate email
    const existing = await Recruiter.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: `A recruiter with email "${email}" already exists.` });
    }

    const recruiter = await Recruiter.create({
      email: email.trim().toLowerCase(),
      company: (company || '').trim(),
      recruiterName: (recruiterName || '').trim(),
      source: 'manual',
    });

    return res.status(201).json({ message: 'Recruiter added successfully.', recruiter });
  } catch (error) {
    console.error('Manual recruiter add error:', error);
    return res.status(500).json({ error: `Failed to add recruiter: ${error.message}` });
  }
});

/**
 * POST /api/recruiters/excel
 * Upload an Excel file and import recruiters.
 */
router.post('/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file" with an Excel file.' });
    }

    const fs = require('fs');
    const buffer = fs.readFileSync(req.file.path);
    const parsed = parseExcel(buffer);

    if (parsed.length === 0) {
      return res.status(400).json({ error: 'No valid recruiter rows found in the Excel file.' });
    }

    const existingEmails = new Set(
      (await Recruiter.find({}, 'email')).map((r) => r.email.toLowerCase())
    );
    let added = 0;
    let skipped = 0;

    for (const row of parsed) {
      if (existingEmails.has(row.email.toLowerCase())) {
        skipped++;
        continue;
      }
      await Recruiter.create({
        email: row.email.toLowerCase(),
        company: row.company,
        recruiterName: row.recruiterName,
        source: 'excel',
      });
      existingEmails.add(row.email.toLowerCase());
      added++;
    }

    const total = await Recruiter.countDocuments();

    return res.status(200).json({
      message: `Imported ${added} recruiter(s). Skipped ${skipped} duplicate(s).`,
      added,
      skipped,
      total,
    });
  } catch (error) {
    console.error('Excel import error:', error);
    return res.status(500).json({ error: `Failed to import Excel file: ${error.message}` });
  }
});

/**
 * POST /api/recruiters/sheets
 * Import recruiters from a public Google Sheets URL.
 */
router.post('/sheets', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'A Google Sheets URL is required.' });
    }

    const parsed = await parseGoogleSheet(url);

    if (parsed.length === 0) {
      return res.status(400).json({ error: 'No valid recruiter rows found in the Google Sheet.' });
    }

    const existingEmails = new Set(
      (await Recruiter.find({}, 'email')).map((r) => r.email.toLowerCase())
    );
    let added = 0;
    let skipped = 0;

    for (const row of parsed) {
      if (existingEmails.has(row.email.toLowerCase())) {
        skipped++;
        continue;
      }
      await Recruiter.create({
        email: row.email.toLowerCase(),
        company: row.company,
        recruiterName: row.recruiterName,
        source: 'sheets',
      });
      existingEmails.add(row.email.toLowerCase());
      added++;
    }

    const total = await Recruiter.countDocuments();

    return res.status(200).json({
      message: `Imported ${added} recruiter(s) from Google Sheets. Skipped ${skipped} duplicate(s).`,
      added,
      skipped,
      total,
    });
  } catch (error) {
    console.error('Google Sheets import error:', error);
    return res.status(500).json({ error: `Failed to import from Google Sheets: ${error.message}` });
  }
});

/**
 * GET /api/recruiters
 * List all recruiters.
 */
router.get('/', async (req, res) => {
  try {
    const recruiters = await Recruiter.find().sort({ createdAt: -1 });
    return res.status(200).json({ recruiters, total: recruiters.length });
  } catch (error) {
    console.error('List recruiters error:', error);
    return res.status(500).json({ error: `Failed to list recruiters: ${error.message}` });
  }
});

/**
 * POST /api/recruiters/bulk-delete
 * Delete multiple recruiters by ID.
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No recruiter IDs provided.' });
    }

    const result = await Recruiter.deleteMany({ _id: { $in: ids } });
    
    // Cascade delete their applications (optional but good practice)
    const { Application } = require('../models');
    await Application.deleteMany({ recruiterId: { $in: ids } });

    return res.status(200).json({ message: `Deleted ${result.deletedCount} recruiters.`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({ error: `Failed to bulk delete recruiters: ${error.message}` });
  }
});

/**
 * DELETE /api/recruiters/:id
 * Remove a recruiter by ID.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await Recruiter.findByIdAndDelete(id);

    if (!removed) {
      return res.status(404).json({ error: 'Recruiter not found.' });
    }

    return res.status(200).json({ message: 'Recruiter removed.', recruiter: removed });
  } catch (error) {
    console.error('Delete recruiter error:', error);
    return res.status(500).json({ error: `Failed to delete recruiter: ${error.message}` });
  }
});

module.exports = router;
