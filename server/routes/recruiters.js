const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { Recruiter } = require('../models');
const { parseExcel, parseGoogleSheet, parsePDFRecruiters, ocrParsePDFRecruiters } = require('../services/fileParser');
const { validateEmail, validateEmails } = require('../services/emailValidator');

const router = express.Router();

/**
 * Shared import pipeline used by every bulk source (Excel, PDF, Sheets).
 *
 * Steps: validate each email (syntax + domain deliverability + disposable/typo
 * guards), drop invalid + duplicate rows, then bulk-insert the survivors.
 * Invalid contacts are never persisted, so they can never reach AI generation
 * or an outbound campaign. The import always completes — bad rows are reported,
 * not fatal.
 *
 * @returns {object} response payload including a per-email rejection breakdown.
 */
async function importRecruiters(userId, rows, source) {
  const processed = rows.length;

  // Existing emails for duplicate detection — one indexed query.
  const existingEmails = new Set(
    (await Recruiter.find({ userId }, 'email')).map((r) => r.email.toLowerCase())
  );

  // Validate every email up-front: batched, bounded concurrency, cached DNS.
  const validations = await validateEmails(rows.map((r) => r.email));

  const toInsert = [];
  const rejected = [];
  const seenInBatch = new Set();
  let duplicates = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = validations[i];

    if (!result.valid) {
      rejected.push({
        email: result.input || row.email || '',
        reason: result.reason,
        message: result.message,
        ...(result.suggestion ? { suggestion: result.suggestion } : {}),
      });
      continue;
    }

    const email = result.normalized;
    // Duplicate against the DB or an earlier row in this same file.
    if (existingEmails.has(email) || seenInBatch.has(email)) {
      duplicates++;
      continue;
    }

    seenInBatch.add(email);
    toInsert.push({
      userId,
      email,
      company: (row.company || '').trim(),
      recruiterName: (row.recruiterName || '').trim(),
      source,
    });
  }

  let imported = 0;
  if (toInsert.length > 0) {
    // ordered:false → a single dup-key race won't abort the whole batch.
    try {
      const inserted = await Recruiter.insertMany(toInsert, { ordered: false });
      imported = inserted.length;
    } catch (err) {
      imported = err.insertedDocs ? err.insertedDocs.length : (err.result?.result?.nInserted ?? 0);
      duplicates += toInsert.length - imported;
    }
  }

  const total = await Recruiter.countDocuments({ userId });

  return {
    summary: { processed, imported, duplicates, rejected: rejected.length },
    rejectedDetails: rejected,
    // Backward-compatible fields for any older client code.
    added: imported,
    skipped: duplicates,
    total,
  };
}

/**
 * Build a concise human summary line for a toast/notification.
 */
function buildImportMessage(result, label) {
  const { imported, duplicates, rejected } = result.summary;
  const parts = [`Imported ${imported} recruiter(s)${label ? ` from ${label}` : ''}.`];
  if (duplicates) parts.push(`Skipped ${duplicates} duplicate(s).`);
  if (rejected) parts.push(`Rejected ${rejected} invalid email(s).`);
  return parts.join(' ');
}

// Configure multer for Excel/PDF uploads
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
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|xls|csv|pdf)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls), CSV, and PDF files are allowed.'), false);
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

    if (!email) {
      return res.status(400).json({ error: 'An email address is required.' });
    }

    // Full validation: syntax + domain deliverability + disposable/typo guards.
    const validation = await validateEmail(email);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.suggestion
          ? `${validation.message} Did you mean ${validation.suggestion}?`
          : validation.message,
        reason: validation.reason,
        ...(validation.suggestion ? { suggestion: validation.suggestion } : {}),
      });
    }

    const normalizedEmail = validation.normalized;

    // Check for duplicate email
    const existing = await Recruiter.findOne({ email: normalizedEmail, userId: req.user._id });
    if (existing) {
      return res.status(409).json({ error: `A recruiter with email "${normalizedEmail}" already exists.` });
    }

    const recruiter = await Recruiter.create({
      userId: req.user._id,
      email: normalizedEmail,
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

    const result = await importRecruiters(req.user._id, parsed, 'excel');

    return res.status(200).json({
      message: buildImportMessage(result, 'Excel'),
      ...result,
    });
  } catch (error) {
    console.error('Excel import error:', error);
    return res.status(500).json({ error: `Failed to import Excel file: ${error.message}` });
  }
});

/**
 * POST /api/recruiters/pdf
 * Upload a PDF file containing HR recruiter contacts and import them.
 * Expected PDF table columns: SNo, Name, Email, Title, Company
 * Query params:
 *   - ocr=true: Use OCR engine for scanned/image-based PDFs (slower but handles images)
 */
router.post('/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file" with a PDF file.' });
    }

    const useOCR = req.query.ocr === 'true';
    const fs = require('fs');
    const buffer = fs.readFileSync(req.file.path);

    let parsed;
    if (useOCR) {
      console.log('[PDF Import] Using OCR engine for scanned PDF...');
      parsed = await ocrParsePDFRecruiters(buffer);
    } else {
      parsed = await parsePDFRecruiters(buffer);
    }

    if (parsed.length === 0) {
      return res.status(400).json({
        error: useOCR
          ? 'No valid recruiter rows found via OCR. Ensure the PDF has a readable table with columns like SNo, Name, Email, Title, Company.'
          : 'No valid recruiter rows found in the PDF. Try enabling OCR mode if this is a scanned/image-based PDF.',
      });
    }

    const result = await importRecruiters(req.user._id, parsed, 'pdf');

    return res.status(200).json({
      message: buildImportMessage(result, `PDF${useOCR ? ' (OCR)' : ''}`),
      ...result,
    });
  } catch (error) {
    console.error('PDF import error:', error);
    return res.status(500).json({ error: `Failed to import PDF file: ${error.message}` });
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

    const result = await importRecruiters(req.user._id, parsed, 'sheets');

    return res.status(200).json({
      message: buildImportMessage(result, 'Google Sheets'),
      ...result,
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
    const recruiters = await Recruiter.find({ userId: req.user._id }).sort({ createdAt: -1 });
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

    const result = await Recruiter.deleteMany({ _id: { $in: ids }, userId: req.user._id });
    
    // Cascade delete their applications (optional but good practice)
    const { Application } = require('../models');
    await Application.deleteMany({ recruiterId: { $in: ids }, userId: req.user._id });

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
    const removed = await Recruiter.findOneAndDelete({ _id: id, userId: req.user._id });

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
