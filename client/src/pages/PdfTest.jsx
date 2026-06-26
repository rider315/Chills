import React, { useState, useRef, useCallback } from 'react';
import { upload } from '../utils/api';

/* ───────────────────────── helpers ───────────────────────── */

/** Convert recruiters array to CSV string */
function toCSV(recruiters) {
  const header = 'S.No,Name,Email,Company';
  const rows = recruiters.map(
    (r, i) =>
      `${i + 1},"${(r.recruiterName || '').replace(/"/g, '""')}","${(r.email || '').replace(/"/g, '""')}","${(r.company || '').replace(/"/g, '""')}"`
  );
  return [header, ...rows].join('\n');
}

/** Trigger browser download of text content */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ───────────────────────── component ───────────────────────── */

export default function PdfTest() {
  // Upload state
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [useOCR, setUseOCR] = useState(false);
  const fileInputRef = useRef(null);

  // Extraction state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { filename, useOCR, extractionTimeMs, total, recruiters }

  // Search / sort
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('email');
  const [sortDir, setSortDir] = useState('asc');

  /* ─── drag & drop ─── */
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setError('');
    } else {
      setError('Please drop a valid PDF file.');
    }
  }, []);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  /* ─── extract ─── */
  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const url = `/api/pdf-test/extract${useOCR ? '?ocr=true' : ''}`;
      const data = await upload(url, formData);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Extraction failed.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── reset ─── */
  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setSearch('');
    setSortField('email');
    setSortDir('asc');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ─── export ─── */
  const handleExportJSON = () => {
    if (!result) return;
    const json = JSON.stringify(result.recruiters, null, 2);
    downloadFile(json, `pdf-extract-${Date.now()}.json`, 'application/json');
  };

  const handleExportCSV = () => {
    if (!result) return;
    const csv = toCSV(result.recruiters);
    downloadFile(csv, `pdf-extract-${Date.now()}.csv`, 'text/csv');
  };

  /* ─── filter & sort recruiters ─── */
  const getFilteredRecruiters = () => {
    if (!result) return [];
    let list = [...result.recruiters];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.email || '').toLowerCase().includes(q) ||
          (r.recruiterName || '').toLowerCase().includes(q) ||
          (r.company || '').toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      const aVal = (a[sortField] || '').toLowerCase();
      const bVal = (b[sortField] || '').toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return '⇅';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const filtered = getFilteredRecruiters();

  /* ─── copy all emails ─── */
  const handleCopyEmails = () => {
    if (!result) return;
    const emails = result.recruiters.map((r) => r.email).join('\n');
    navigator.clipboard.writeText(emails);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-2">
          🔬 PDF Import Tester
        </h1>
        <p className="text-base font-medium text-gray-600">
          Upload a PDF to test email extraction. Export the results as JSON/CSV, then share
          them along with a screenshot of the PDF so I can cross-verify the accuracy.
        </p>
      </div>

      {/* Step 1 — Upload */}
      <div className="card-neo mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-border bg-neo-blue text-bw font-black text-lg shadow-neosm">
            1
          </span>
          <h2 className="text-xl font-black uppercase">Upload PDF</h2>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-base p-10 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-neo-blue bg-blue-50 -translate-y-1 shadow-neo'
              : file
              ? 'border-neo-green bg-green-50'
              : 'border-gray-400 hover:border-border hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />

          {file ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📄</span>
              <span className="font-bold text-lg">{file.name}</span>
              <span className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                className="mt-2 text-xs font-bold text-neo-red underline underline-offset-4 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
              >
                Remove & upload another
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl">📥</span>
              <span className="font-bold text-lg">
                Drag & drop your PDF here
              </span>
              <span className="text-sm text-gray-500">
                or click to browse · Max 10 MB
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mt-5">
          {/* OCR Toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`relative w-14 h-8 rounded-full border-2 border-border transition-colors ${
                useOCR ? 'bg-neo-blue' : 'bg-gray-200'
              }`}
              onClick={() => setUseOCR((v) => !v)}
            >
              <div
                className={`absolute top-[2px] w-6 h-6 rounded-full border-2 border-border bg-bw shadow-neosm transition-transform ${
                  useOCR ? 'translate-x-[26px]' : 'translate-x-[2px]'
                }`}
              />
            </div>
            <span className="font-bold text-sm">
              OCR Mode{' '}
              <span className="text-gray-500 font-medium">(for scanned PDFs)</span>
            </span>
          </label>

          <div className="flex-1" />

          {/* Extract button */}
          <button
            className="btn-neo btn-neo-green text-base px-8 py-3"
            onClick={handleExtract}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block">⏳</span> Extracting…
              </>
            ) : (
              <>🔍 Extract Emails</>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-base border-2 border-neo-red bg-red-50 text-neo-red font-bold text-sm">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Step 2 — Results */}
      {result && (
        <div className="card-neo mb-6 animate-in">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-border bg-neo-green text-text font-black text-lg shadow-neosm">
              2
            </span>
            <h2 className="text-xl font-black uppercase">Extraction Results</h2>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Total Emails"
              value={result.total}
              icon="📧"
              color="bg-neo-blue text-bw"
            />
            <StatCard
              label="Time Taken"
              value={`${result.extractionTimeMs}ms`}
              icon="⚡"
              color="bg-neo-yellow text-text"
            />
            <StatCard
              label="Source File"
              value={result.filename.length > 15 ? result.filename.slice(0, 15) + '…' : result.filename}
              icon="📄"
              color="bg-neo-green text-text"
            />
            <StatCard
              label="Mode"
              value={result.useOCR ? 'OCR' : 'Text'}
              icon={result.useOCR ? '🔠' : '📝'}
              color="bg-neo-purple text-bw"
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                🔎
              </span>
              <input
                type="text"
                placeholder="Search emails, names, companies…"
                className="input-neo pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Action buttons */}
            <button
              className="btn-neo btn-neo-white text-xs py-2 px-4"
              onClick={handleCopyEmails}
              title="Copy all emails to clipboard"
            >
              📋 Copy Emails
            </button>
            <button
              className="btn-neo btn-neo-yellow text-xs py-2 px-4"
              onClick={handleExportJSON}
            >
              💾 Export JSON
            </button>
            <button
              className="btn-neo btn-neo-green text-xs py-2 px-4"
              onClick={handleExportCSV}
            >
              📊 Export CSV
            </button>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-medium">
              {search ? 'No results match your search.' : 'No recruiter emails were extracted.'}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar border-2 border-border rounded-base">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-border">
                    <th className="text-left p-3 font-black w-14">#</th>
                    <th
                      className="text-left p-3 font-black cursor-pointer select-none hover:text-neo-blue transition-colors"
                      onClick={() => handleSort('recruiterName')}
                    >
                      Name {sortIcon('recruiterName')}
                    </th>
                    <th
                      className="text-left p-3 font-black cursor-pointer select-none hover:text-neo-blue transition-colors"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortIcon('email')}
                    </th>
                    <th
                      className="text-left p-3 font-black cursor-pointer select-none hover:text-neo-blue transition-colors"
                      onClick={() => handleSort('company')}
                    >
                      Company {sortIcon('company')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-200 transition-colors hover:bg-yellow-50 ${
                        i % 2 === 0 ? 'bg-bw' : 'bg-gray-50'
                      }`}
                    >
                      <td className="p-3 font-bold text-gray-400">{i + 1}</td>
                      <td className="p-3 font-medium">{r.recruiterName || '—'}</td>
                      <td className="p-3">
                        <span className="font-mono text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 break-all">
                          {r.email}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-700">{r.company || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Count label */}
          {search && filtered.length > 0 && (
            <p className="text-xs font-bold text-gray-500 mt-2">
              Showing {filtered.length} of {result.total} results
            </p>
          )}
        </div>
      )}

      {/* Step 3 — Instructions */}
      {result && result.total > 0 && (
        <div className="card-neo border-neo-blue mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-border bg-neo-yellow text-text font-black text-lg shadow-neosm">
              3
            </span>
            <h2 className="text-xl font-black uppercase">Cross-Verify</h2>
          </div>
          <div className="space-y-3 text-sm font-medium text-gray-700">
            <p>
              <strong className="text-text">To verify these results are accurate:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                Export the results above as <strong>JSON</strong> or <strong>CSV</strong>
              </li>
              <li>
                Take a <strong>screenshot</strong> of the original PDF showing the email addresses
              </li>
              <li>
                Share both the <strong>exported file</strong> and the <strong>screenshot</strong>{' '}
                in our chat
              </li>
              <li>
                I'll cross-verify every email and flag any{' '}
                <strong>missing, extra, or incorrectly extracted</strong> entries
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card sub-component ─── */
function StatCard({ label, value, icon, color }) {
  return (
    <div className="border-2 border-border rounded-base shadow-neosm overflow-hidden">
      <div className={`${color} px-3 py-2 flex items-center gap-2`}>
        <span className="text-lg">{icon}</span>
        <span className="font-black text-lg truncate">{value}</span>
      </div>
      <div className="bg-bw px-3 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
    </div>
  );
}
