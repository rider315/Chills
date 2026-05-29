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

module.exports = {
  parsePDF,
  parseExcel,
  parseGoogleSheet,
};
