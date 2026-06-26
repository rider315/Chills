const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { parsePDFRecruiters, ocrParsePDFRecruiters } = require('../services/fileParser');

const router = express.Router();

// Configure multer for PDF uploads (reuse uploads dir)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `pdftest-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * POST /api/pdf-test/extract
 * Upload a PDF, run the extraction pipeline, and return results as JSON.
 * This is a testing/debugging endpoint — it does NOT write to the database.
 *
 * Query params:
 *   - ocr=true  → use OCR engine (slower, for scanned PDFs)
 *
 * Response:
 *   {
 *     filename: string,
 *     useOCR: boolean,
 *     extractionTimeMs: number,
 *     total: number,
 *     recruiters: [ { email, recruiterName, company } ]
 *   }
 */
router.post('/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file" with a PDF.' });
    }

    const useOCR = req.query.ocr === 'true';
    const buffer = fs.readFileSync(req.file.path);

    const startTime = Date.now();
    let recruiters;

    if (useOCR) {
      console.log('[PDF Test] Using OCR engine...');
      recruiters = await ocrParsePDFRecruiters(buffer);
    } else {
      recruiters = await parsePDFRecruiters(buffer);
    }
    const extractionTimeMs = Date.now() - startTime;

    // Clean up the uploaded file (it's just for testing)
    fs.unlink(req.file.path, () => {});

    return res.status(200).json({
      filename: req.file.originalname,
      useOCR,
      extractionTimeMs,
      total: recruiters.length,
      recruiters,
    });
  } catch (error) {
    console.error('PDF Test extract error:', error);
    return res.status(500).json({ error: `Extraction failed: ${error.message}` });
  }
});

module.exports = router;
