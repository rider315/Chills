const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');

/**
 * Extract text content from a PDF buffer.
 */
async function parsePDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

/**
 * Parse an Excel file buffer and extract recruiter rows.
 * Auto-detects columns containing "email", "company", and "name".
 */
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel file contains no sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    return [];
  }

  // Auto-detect columns by inspecting headers
  const headers = Object.keys(rows[0]);
  const emailCol = headers.find((h) => /email/i.test(h));
  const companyCol = headers.find((h) => /company|org|organization|employer/i.test(h));
  const nameCol = headers.find((h) => /name|recruiter|contact/i.test(h));

  if (!emailCol) {
    throw new Error(
      'Could not find an email column in the Excel file. Ensure one of the column headers contains the word "email".'
    );
  }

  const recruiters = rows
    .filter((row) => {
      const email = String(row[emailCol] || '').trim();
      return email && email.includes('@');
    })
    .map((row) => ({
      email: String(row[emailCol] || '').trim(),
      company: String(row[companyCol] || '').trim(),
      recruiterName: String(row[nameCol] || '').trim(),
    }));

  return recruiters;
}

/**
 * Parse a Google Sheets URL — extract the spreadsheet ID, fetch as CSV, and parse.
 */
async function parseGoogleSheet(url) {
  // Extract spreadsheet ID from various Google Sheets URL formats
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /key=([a-zA-Z0-9_-]+)/,
  ];

  let spreadsheetId = null;
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      spreadsheetId = match[1];
      break;
    }
  }

  if (!spreadsheetId) {
    throw new Error('Could not extract spreadsheet ID from the provided URL. Please provide a valid Google Sheets URL.');
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Google Sheet. Make sure the sheet is publicly accessible (Share → Anyone with the link). Status: ${response.status}`
    );
  }

  const csvText = await response.text();
  return parseCSV(csvText);
}

/**
 * Parse CSV text into recruiter objects.
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  // Parse header row (handle quoted fields)
  const headers = parseCSVRow(lines[0]);

  const emailIdx = headers.findIndex((h) => /email/i.test(h));
  const companyIdx = headers.findIndex((h) => /company|org|organization|employer/i.test(h));
  const nameIdx = headers.findIndex((h) => /name|recruiter|contact/i.test(h));

  if (emailIdx === -1) {
    throw new Error(
      'Could not find an email column in the Google Sheet. Ensure one of the column headers contains the word "email".'
    );
  }

  const recruiters = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const email = (cols[emailIdx] || '').trim();
    if (email && email.includes('@')) {
      recruiters.push({
        email,
        company: (companyIdx >= 0 ? cols[companyIdx] || '' : '').trim(),
        recruiterName: (nameIdx >= 0 ? cols[nameIdx] || '' : '').trim(),
      });
    }
  }

  return recruiters;
}

/**
 * Parse a single CSV row, respecting quoted fields.
 */
function parseCSVRow(row) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse a PDF buffer containing a table of HR recruiter contacts.
 * Expected columns: SNo, Name, Email, Title, Company
 * 
 * PDF text extraction often concatenates columns with zero spacing, e.g.:
 *   "1Akanksha Puriakanksha.puri@sourcefuse.comAssociate Director HRSourceFuse Technologies"
 * So we use the email address as an anchor to split each line.
 */
async function parsePDFRecruiters(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text || '';
  return extractRecruitersFromText(text);
}

/**
 * Extract recruiter data from raw text using email-first detection.
 * 
 * Handles the common case where pdf-parse concatenates columns:
 *   "1Akanksha Puriakanksha.puri@sourcefuse.comAssociate Director HRSourceFuse Technologies"
 *
 * Strategy:
 *   1. Find the @ sign → locate the domain (with known TLD boundary)
 *   2. Walk left from @ to find the email local part
 *   3. Derive the recruiter name from the email local part (e.g., akanksha.puri → Akanksha Puri)
 *   4. Extract company from after the email using camelCase boundary heuristics
 */
function extractRecruitersFromText(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  // Common TLDs to detect where the domain ends in zero-spaced text
  const tldPattern = /^([\w.\-]+\.(?:com|co\.in|co|in|io|ai|org|net|ch|edu|gov|info|biz|me|us|uk|de|fr|ca|au))/i;

  // Skip header lines
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (/e[\-]?mail/i.test(lines[i]) && /name/i.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }

  const recruiters = [];
  const seenEmails = new Set();

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Find all @ signs in this line
    let searchFrom = 0;
    while (searchFrom < line.length) {
      const atIdx = line.indexOf('@', searchFrom);
      if (atIdx < 0) break;

      // --- Extract Domain (right of @) ---
      const domainRaw = line.substring(atIdx + 1);
      const tldMatch = domainRaw.match(tldPattern);
      if (!tldMatch) {
        searchFrom = atIdx + 1;
        continue;
      }
      const domain = tldMatch[1];
      const emailEnd = atIdx + 1 + domain.length;

      // --- Extract Local Part (left of @) ---
      // Walk left from @ while characters are valid email chars
      let localStart = atIdx - 1;
      while (localStart >= 0 && /[a-zA-Z0-9._\-+]/.test(line[localStart])) {
        localStart--;
      }
      localStart++; // move to first valid char
      const fullLocal = line.substring(localStart, atIdx);

      // ===== FIND EMAIL BOUNDARY =====
      // The PDF concatenates: [SNo][FirstName LastName][email@domain][Title][Company]
      // When zero-spaced: "1Akanksha Puriakanksha.puri@sourcefuse.com..."
      // Walking left from @ stopped at the space, giving fullLocal = "Puriakanksha.puri"
      // The last name "Puri" is glued to the email "akanksha.puri"
      // Strategy: find the first name from the text BEFORE fullLocal, then locate it in fullLocal

      let realLocalStart = localStart;
      const textBeforeLocal = line.substring(0, localStart);

      // Extract all alphabetic words from the text before the email local part
      const precedingWords = textBeforeLocal.match(/[a-zA-Z]{2,}/g) || [];

      if (precedingWords.length > 0) {
        // Strategy 1: Match a preceding word (the first name) inside fullLocal
        // Try each word starting from the first one (most reliable)
        const lowerFull = fullLocal.toLowerCase();
        for (let w = 0; w < precedingWords.length; w++) {
          const word = precedingWords[w].toLowerCase();
          if (word.length < 2) continue;
          const idx = lowerFull.indexOf(word);
          if (idx > 0) {
            // Verify: the resulting email local part should be at least 2 chars
            const candidateLocal = fullLocal.substring(idx);
            if (candidateLocal.length >= 2) {
              realLocalStart = localStart + idx;
              break;
            }
          }
        }
      }

      // Strategy 2: For single-word names (no preceding words found, or Strategy 1 didn't match)
      if (realLocalStart === localStart && fullLocal.length >= 4) {
        // Strip leading digits (serial numbers like "18" in "18Amitamit.malhotra")
        const stripped = fullLocal.replace(/^\d+/, '');
        const digitOffset = fullLocal.length - stripped.length;

        if (stripped.length >= 4) {
          // 2a: Dot-based approach — if email has a dot, check if beforeDot starts with afterDot
          const dotPos = stripped.indexOf('.');
          if (dotPos > 0) {
            const afterDot = stripped.substring(dotPos + 1);
            const beforeDot = stripped.substring(0, dotPos);
            const lowerBefore = beforeDot.toLowerCase();
            const lowerAfter = afterDot.toLowerCase();

            if (lowerAfter.length >= 2 && lowerBefore.startsWith(lowerAfter)) {
              // "Puriakanksha" starts with "puri" → skip the last name prefix
              realLocalStart = localStart + digitOffset + lowerAfter.length;
            } else if (lowerBefore.length >= 4) {
              // Try duplicate detection on beforeDot (e.g., "Amitamit" → "amit" repeated)
              const lb = lowerBefore;
              for (let halfLen = Math.floor(lb.length / 2); halfLen >= 2; halfLen--) {
                const suffix = lb.substring(lb.length - halfLen);
                const idx = lb.indexOf(suffix);
                if (idx >= 0 && idx < lb.length - halfLen) {
                  realLocalStart = localStart + digitOffset + (lb.length - halfLen);
                  break;
                }
              }
            }
          } else {
            // 2b: No dot — duplicate detection on whole stripped local
            const lower = stripped.toLowerCase();
            for (let halfLen = Math.floor(lower.length / 2); halfLen >= 2; halfLen--) {
              const suffix = lower.substring(lower.length - halfLen);
              const idx = lower.indexOf(suffix);
              if (idx >= 0 && idx < lower.length - halfLen) {
                realLocalStart = localStart + digitOffset + (lower.length - halfLen);
                break;
              }
            }
          }
        } else if (digitOffset > 0) {
          // Just strip the digits
          realLocalStart = localStart + digitOffset;
        }
      }

      const email = line.substring(realLocalStart, emailEnd);

      // Skip if email is clearly invalid
      if (!email.includes('@') || email.length < 5) {
        searchFrom = emailEnd;
        continue;
      }

      // Deduplicate
      if (seenEmails.has(email.toLowerCase())) {
        searchFrom = emailEnd;
        continue;
      }
      seenEmails.add(email.toLowerCase());

      // --- Derive Recruiter Name ---
      // Prefer the actual name from the PDF text (before the email)
      const textBeforeEmail = line.substring(0, realLocalStart);
      let recruiterName = textBeforeEmail.replace(/^\d+/, '').trim(); // Strip serial number

      if (!recruiterName || recruiterName.length < 2) {
        // Fallback: derive name from email local part
        const localPart = email.split('@')[0];
        recruiterName = localPart
          .replace(/[._\-+]/g, ' ')
          .split(' ')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }

      // --- Extract Company (after email) ---
      const afterEmail = line.substring(emailEnd).trim();
      let company = '';

      if (afterEmail.length > 0) {
        // Try splitting by 2+ spaces first (works for spaced text)
        const spacedParts = afterEmail.split(/\s{2,}/).filter(Boolean);
        if (spacedParts.length >= 2) {
          company = spacedParts[spacedParts.length - 1].trim();
        } else {
          // Zero-spacing: find company by detecting the last camelCase boundary
          const boundaries = [];
          for (let j = 0; j < afterEmail.length - 1; j++) {
            if (/[a-z]/.test(afterEmail[j]) && /[A-Z]/.test(afterEmail[j + 1])) {
              boundaries.push(j + 1);
            }
          }

          if (boundaries.length > 0) {
            let bestCompany = '';
            for (let b = boundaries.length - 1; b >= 0; b--) {
              const candidate = afterEmail.substring(boundaries[b]).trim();
              if (candidate.length >= 3) {
                bestCompany = candidate;
                break;
              }
            }
            company = bestCompany || afterEmail;
          } else {
            company = afterEmail;
          }
        }
      }

      // Clean up company name
      company = company.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '').trim();

      if (email) {
        recruiters.push({ email, company, recruiterName });
      }

      searchFrom = emailEnd;
    }
  }

  return recruiters;
}
/**
 * OCR-based PDF parsing — smart "try everything" mode.
 * 
 * Strategy:
 *   1. First try text extraction via pdf-parse (fast, works for digital PDFs)
 *   2. If text extraction finds recruiters, return them immediately
 *   3. Only if text extraction yields nothing, fall back to canvas rendering + Tesseract OCR
 *      (for scanned/image-based PDFs)
 */
async function ocrParsePDFRecruiters(buffer) {
  // --- Phase 1: Try text extraction first (fast path) ---
  console.log('[OCR] Phase 1: Attempting text extraction...');
  try {
    const textData = await pdfParse(buffer);
    const text = textData.text || '';
    
    if (text.trim().length > 50) {
      const textRecruiters = extractRecruitersFromText(text);
      if (textRecruiters.length > 0) {
        console.log(`[OCR] Text extraction found ${textRecruiters.length} recruiters. Skipping image OCR.`);
        return textRecruiters;
      }
    }
    console.log('[OCR] Text extraction found no recruiters. Falling back to image OCR...');
  } catch (e) {
    console.log('[OCR] Text extraction failed:', e.message, '. Falling back to image OCR...');
  }

  // --- Phase 2: Canvas rendering + Tesseract OCR (slow path) ---
  console.log('[OCR] Phase 2: Rendering PDF pages to images for OCR...');
  const Tesseract = require('tesseract.js');
  const canvas = require('canvas');
  const nodePath = require('path');

  // Polyfill globals BEFORE importing pdfjs-dist (it checks at load time)
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
  if (!globalThis.ImageData) globalThis.ImageData = canvas.ImageData;
  if (!globalThis.Path2D) {
    globalThis.Path2D = class Path2D {
      constructor() {}
      addPath() {} moveTo() {} lineTo() {} bezierCurveTo() {}
      quadraticCurveTo() {} arc() {} arcTo() {} ellipse() {}
      rect() {} closePath() {}
    };
  }

  // Import pdfjs-dist via ESM wrapper (after polyfills are set)
  const wrapperPath = nodePath.join(__dirname, 'pdfjsWrapper.mjs');
  const wrapperUrl = 'file:///' + wrapperPath.replace(/\\/g, '/');
  const { getDocument } = await import(wrapperUrl);

  // NodeCanvasFactory for pdfjs-dist rendering
  class NodeCanvasFactory {
    create(width, height) {
      const c = canvas.createCanvas(width, height);
      return { canvas: c, context: c.getContext('2d') };
    }
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
  }

  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const numPages = doc.numPages;

  console.log(`[OCR] PDF has ${numPages} page(s). Rendering and running Tesseract...`);

  const worker = await Tesseract.createWorker('eng');
  const canvasFactory = new NodeCanvasFactory();
  const SCALE = 3.0; // 3x scale for better OCR accuracy

  let combinedText = '';
  try {
    for (let i = 1; i <= numPages; i++) {
      console.log(`[OCR] Processing page ${i}/${numPages}...`);
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });

      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

      // Fill white background
      canvasAndContext.context.fillStyle = 'white';
      canvasAndContext.context.fillRect(0, 0, viewport.width, viewport.height);

      await page.render({
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory,
      }).promise;

      const pngBuffer = canvasAndContext.canvas.toBuffer('image/png');
      const { data: { text } } = await worker.recognize(pngBuffer);
      combinedText += text + '\n';

      canvasFactory.destroy(canvasAndContext);
      page.cleanup();
    }
  } finally {
    await worker.terminate();
  }

  console.log(`[OCR] Tesseract extracted ${combinedText.length} characters.`);

  const ocrRecruiters = extractRecruitersFromText(combinedText);
  console.log(`[OCR] Found ${ocrRecruiters.length} recruiters from OCR.`);
  return ocrRecruiters;
}

module.exports = {
  parsePDF,
  parsePDFRecruiters,
  ocrParsePDFRecruiters,
  parseExcel,
  parseGoogleSheet,
};

