import React, { useState, useEffect } from 'react';
import { get, post, put } from '../utils/api';
import { useToast } from '../components/Toast';
import EmailPreview from '../components/EmailPreview';
import './Emails.css';

/**
 * Flatten an application object into the shape EmailPreview expects.
 */
function normalizeEmail(data) {
  if (!data) return null;
  const app = data.application || data;
  const gen = app.generatedEmail || {};
  return {
    applicationId: app._id || app.id,
    subject: gen.subject || app.subject || '',
    body: gen.body || app.body || '',
    companyResearch: app.companyResearch || null,
    suggestedSendTime: app.suggestedSendTime || '',
    status: app.status || 'draft',
    recruiterEmail: app.recruiterEmail || '',
    recruiterName: app.recruiterName || '',
    company: app.company || '',
  };
}

export default function Emails() {
  const toast = useToast();
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ active: false, type: '', current: 0, total: 0, company: '' });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRecruiters, setSelectedRecruiters] = useState([]);
  const [emailMap, setEmailMap] = useState({});
  const [statusMap, setStatusMap] = useState({}); // recruiterId -> { hasEmail, status }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recruiterData, statusData] = await Promise.all([
        get('/api/recruiters'),
        get('/api/emails/status'),
      ]);
      setRecruiters(recruiterData?.recruiters || recruiterData || []);
      setStatusMap(statusData?.statusMap || {});
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecruiter = async (recruiter) => {
    setSelectedRecruiter(recruiter);
    const rid = recruiter.id || recruiter._id;

    if (emailMap[rid]) {
      setEmail(emailMap[rid]);
      return;
    }

    // Try to fetch existing application for this recruiter
    try {
      const data = await get(`/api/emails/by-recruiter/${rid}`);
      if (data?.application) {
        const emailData = normalizeEmail(data);
        setEmail(emailData);
        setEmailMap((prev) => ({ ...prev, [rid]: emailData }));
      } else {
        setEmail(null);
      }
    } catch {
      setEmail(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedRecruiter) return;
    const rid = selectedRecruiter.id || selectedRecruiter._id;
    const alreadyHas = statusMap[rid]?.hasEmail;
    setGenerating(true);
    setEmail(null);
    try {
      // Use ?force=true if regenerating
      const url = alreadyHas
        ? `/api/emails/generate/${rid}?force=true`
        : `/api/emails/generate/${rid}`;
      const data = await post(url);
      const emailData = normalizeEmail(data);
      setEmail(emailData);
      setEmailMap((prev) => ({ ...prev, [rid]: emailData }));
      setStatusMap((prev) => ({
        ...prev,
        [rid]: { hasEmail: true, status: 'draft', applicationId: emailData.applicationId },
      }));
      toast.success('Email generated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to generate email');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBulk = async (useSelection = false) => {
    let targets = [];
    if (useSelection) {
      targets = recruiters.filter(r => selectedRecruiters.includes(r.id || r._id) && !statusMap[r.id || r._id]?.hasEmail);
    } else {
      targets = recruiters.filter(r => !statusMap[r.id || r._id]?.hasEmail);
    }

    if (targets.length === 0) {
      return toast.info('All selected recruiters already have emails generated.');
    }

    setGeneratingBulk(true);
    setBulkProgress({ active: true, type: 'generate', current: 0, total: targets.length, company: '' });
    
    let generated = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      const rid = r.id || r._id;
      setBulkProgress(prev => ({ ...prev, current: i + 1, company: r.company }));

      try {
        const data = await post(`/api/emails/generate/${rid}`);
        const emailData = normalizeEmail(data);
        
        // Update local maps
        setEmailMap(prev => ({ ...prev, [rid]: emailData }));
        setStatusMap(prev => ({
          ...prev,
          [rid]: { hasEmail: true, status: 'draft', applicationId: emailData.applicationId },
        }));
        
        generated++;
      } catch (err) {
        failed++;
        toast.error(`Failed to generate for ${r.company}: ${err.message}`);
      }
    }

    setGeneratingBulk(false);
    setBulkProgress({ active: false, type: '', current: 0, total: 0, company: '' });
    toast.success(`Bulk generation complete! Generated: ${generated}, Failed: ${failed}`);
  };

  const handleSendBulk = async (useSelection = false) => {
    let targets = [];
    if (useSelection) {
      targets = recruiters.filter(r => selectedRecruiters.includes(r.id || r._id) && statusMap[r.id || r._id]?.hasEmail && statusMap[r.id || r._id]?.status !== 'sent');
    } else {
      targets = recruiters.filter(r => statusMap[r.id || r._id]?.hasEmail && statusMap[r.id || r._id]?.status !== 'sent');
    }

    if (targets.length === 0) {
      return toast.info('No draft emails ready to send.');
    }

    const msg = useSelection 
      ? `Are you sure you want to send emails to the ${targets.length} selected recruiters?`
      : `Are you sure you want to send all ${targets.length} draft emails?`;
    if (!window.confirm(msg)) return;

    setSendingBulk(true);
    setBulkProgress({ active: true, type: 'send', current: 0, total: targets.length, company: '' });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      const rId = r.id || r._id;
      const appId = statusMap[rId]?.applicationId;
      setBulkProgress(prev => ({ ...prev, current: i + 1, company: r.company }));

      if (!appId) continue;

      try {
        await post(`/api/emails/${appId}/send`);
        sent++;
        
        setStatusMap((prev) => ({
          ...prev,
          [rId]: { ...prev[rId], status: 'sent' },
        }));

        // Delay between sends (2.5 seconds)
        if (i < targets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        }

      } catch (err) {
        failed++;
        toast.error(`Failed to send to ${r.company}: ${err.message}`);
      }
    }

    setSendingBulk(false);
    setBulkProgress({ active: false, type: '', current: 0, total: 0, company: '' });
    toast.success(`Bulk sending complete! Sent: ${sent}, Failed: ${failed}`);
  };

  const toggleSelection = (id) => {
    setSelectedRecruiters((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecruiters.length === filtered.length) {
      setSelectedRecruiters([]);
    } else {
      setSelectedRecruiters(filtered.map((r) => r.id || r._id));
    }
  };

  const handleSave = async ({ subject, body }) => {
    if (!selectedRecruiter || !email) return;
    const aid = email.applicationId;
    if (!aid) return;
    try {
      await put(`/api/emails/${aid}`, { subject, body });
      const updated = { ...email, subject, body };
      setEmail(updated);
      const rid = selectedRecruiter.id || selectedRecruiter._id;
      setEmailMap((prev) => ({ ...prev, [rid]: updated }));
      toast.success('Email saved!');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleSend = async () => {
    const aid = email?.applicationId;
    if (!aid) return;
    try {
      const result = await post(`/api/emails/${aid}/send`);
      const msg = result?.resumeAttached
        ? 'Email sent with resume attached! 🎉'
        : 'Email sent successfully! 🎉';
      toast.success(msg);
      // Update status
      const rid = selectedRecruiter?.id || selectedRecruiter?._id;
      if (rid) {
        setStatusMap((prev) => ({
          ...prev,
          [rid]: { ...prev[rid], status: 'sent' },
        }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send email');
    }
  };

  const handleCopy = async () => {
    const aid = email?.applicationId;
    if (!aid) {
      if (email?.body) {
        navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
        toast.success('Email copied to clipboard!');
      }
      return;
    }
    try {
      const data = await post(`/api/emails/${aid}/copy`);
      const text = data?.formatted || `Subject: ${email.subject}\n\n${email.body}`;
      navigator.clipboard.writeText(text);
      toast.success('Email copied to clipboard!');
    } catch {
      if (email?.body) {
        navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
        toast.success('Email copied to clipboard!');
      }
    }
  };

  const filtered = recruiters.filter((r) => {
    const q = search.toLowerCase();
    const textMatch = (
      (r.company || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.recruiterName || r.name || '').toLowerCase().includes(q)
    );

    const rid = r.id || r._id;
    const s = statusMap[rid];
    
    let statusMatch = true;
    if (filterStatus === 'pending') {
      statusMatch = !s || (!s.hasEmail && s.status !== 'sent');
    } else if (filterStatus === 'draft') {
      statusMatch = s?.hasEmail && s?.status !== 'sent';
    } else if (filterStatus === 'sent') {
      statusMatch = s?.status === 'sent';
    }

    return textMatch && statusMatch;
  });

  // Stats
  const totalRecruiters = recruiters.length;
  const generatedCount = Object.values(statusMap).filter((s) => s.hasEmail).length;
  const sentCount = Object.values(statusMap).filter((s) => s.status === 'sent').length;

  return (
    <div className="page-enter emails">
      <div className="emails__header">
        <div>
          <h1 className="emails__title">
            <span className="text-gradient">Emails</span> ✉️
          </h1>
          <p className="text-muted text-sm">Generate personalized cold emails for each recruiter.</p>
        </div>
        <div className="emails__header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          {selectedRecruiters.length > 0 && (
            <>
              <button className="btn btn-ghost" onClick={() => handleSendBulk(true)} disabled={sendingBulk}>
                📤 Send Selected ({selectedRecruiters.length})
              </button>
              <button className="btn btn-ghost" onClick={() => handleGenerateBulk(true)} disabled={generatingBulk}>
                ⚡ Generate Selected ({selectedRecruiters.length})
              </button>
            </>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => handleSendBulk(false)}
            disabled={sendingBulk || generatedCount === 0}
          >
            {sendingBulk ? (
              <><span className="spinner spinner--sm" /> Sending...</>
            ) : (
              '📤 Send All'
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleGenerateBulk(false)}
            disabled={generatingBulk || recruiters.length === 0}
          >
            {generatingBulk ? (
              <><span className="spinner spinner--sm" /> Generating...</>
            ) : (
              '⚡ Generate All'
            )}
          </button>
        </div>
      </div>

      {/* Generation Stats Banner */}
      {totalRecruiters > 0 && (
        <div className="emails__stats glass-card">
          <div className="emails__stat">
            <span className="emails__stat-value">{totalRecruiters}</span>
            <span className="emails__stat-label">Recruiters</span>
          </div>
          <div className="emails__stat-divider" />
          <div className="emails__stat">
            <span className="emails__stat-value emails__stat-value--generated">{generatedCount}</span>
            <span className="emails__stat-label">Generated</span>
          </div>
          <div className="emails__stat-divider" />
          <div className="emails__stat">
            <span className="emails__stat-value emails__stat-value--pending">{totalRecruiters - generatedCount}</span>
            <span className="emails__stat-label">Pending</span>
          </div>
          <div className="emails__stat-divider" />
          <div className="emails__stat">
            <span className="emails__stat-value emails__stat-value--sent">{sentCount}</span>
            <span className="emails__stat-label">Sent</span>
          </div>
        </div>
      )}

      {bulkProgress.active && (
        <div className="emails__bulk-progress glass-card p-md mb-lg">
          <div className="flex items-center justify-between mb-xs">
            <div className="flex items-center gap-sm">
              <span className="spinner spinner--sm" />
              <span className="text-sm font-semibold">
                {bulkProgress.type === 'generate' ? 'Generating email for ' : 'Sending email to '}
                <span className="text-primary">{bulkProgress.company}</span>...
              </span>
            </div>
            <span className="text-sm font-semibold">
              {bulkProgress.current} / {bulkProgress.total}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-bar__fill" 
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, transition: 'width 0.3s ease' }} 
            />
          </div>
        </div>
      )}

      <div className="emails__layout">
        {/* Recruiter List */}
        <div className="emails__sidebar glass-card">
          <div className="emails__search" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recruiters..."
              />
            </div>
            <select 
              className="input" 
              style={{ width: 'auto' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Not Generated</option>
              <option value="draft">Generated (Pending Send)</option>
              <option value="sent">Sent</option>
            </select>
          </div>

          <div className="emails__list">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="emails__list-skeleton">
                  <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="empty-state p-lg">
                <div className="empty-state__icon">👥</div>
                <div className="empty-state__desc">No recruiters found</div>
              </div>
            ) : (
              <>
                <div style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                  <button className="btn btn-ghost btn-sm" onClick={toggleSelectAll}>
                    {selectedRecruiters.length === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedRecruiters.length > 0 && <span className="text-sm font-semibold">{selectedRecruiters.length} selected</span>}
                </div>
                {filtered.map((r) => {
                  const rid = r.id || r._id;
                  const isPreviewSelected = (selectedRecruiter?.id || selectedRecruiter?._id) === rid;
                  const isChecked = selectedRecruiters.includes(rid);
                  const hasEmail = !!emailMap[rid] || statusMap[rid]?.hasEmail;
                  const recruiterStatus = statusMap[rid]?.status;
                  return (
                    <div
                      key={rid}
                      className={`emails__list-item ${isPreviewSelected ? 'emails__list-item--active' : ''} ${isChecked ? 'emails__list-item--selected' : ''}`}
                      onClick={() => handleSelectRecruiter(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => { e.stopPropagation(); toggleSelection(rid); }}
                        style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', flexShrink: 0 }}
                      />
                      <div className="emails__list-item-info" style={{ flex: 1 }}>
                        <span className="emails__list-item-company">{r.company}</span>
                        <span className="emails__list-item-name">{r.recruiterName || r.name || ''}</span>
                        <span className="emails__list-item-email">{r.email}</span>
                      </div>
                      <span
                        className={`emails__list-item-badge ${
                          recruiterStatus === 'sent'
                            ? 'emails__list-item-badge--sent'
                            : hasEmail
                            ? 'emails__list-item-badge--ready'
                            : ''
                        }`}
                        title={
                          recruiterStatus === 'sent'
                            ? 'Sent'
                            : hasEmail
                            ? 'Email generated'
                            : 'Not generated yet'
                        }
                      >
                        {recruiterStatus === 'sent' ? '📤' : hasEmail ? '✅' : '⬜'}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Email Preview */}
        <div className="emails__preview">
          <EmailPreview
            email={email}
            recruiter={selectedRecruiter}
            loading={generating}
            onSend={handleSend}
            onCopy={handleCopy}
            onRegenerate={handleGenerate}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
