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
  const [search, setSearch] = useState('');
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

  const handleGenerateBulk = async () => {
    setGeneratingBulk(true);
    try {
      const data = await post('/api/emails/generate-bulk');
      toast.success(data?.message || 'Bulk generation complete!');
      // Refresh statuses
      setEmailMap({});
      const statusData = await get('/api/emails/status');
      setStatusMap(statusData?.statusMap || {});
    } catch (err) {
      toast.error(err.message || 'Bulk generation failed');
    } finally {
      setGeneratingBulk(false);
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
    return (
      (r.company || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.recruiterName || r.name || '').toLowerCase().includes(q)
    );
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
        <div className="emails__header-actions">
          <button
            className="btn btn-primary"
            onClick={handleGenerateBulk}
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

      {generatingBulk && (
        <div className="emails__bulk-progress glass-card p-md mb-lg">
          <div className="flex items-center gap-sm mb-xs">
            <span className="spinner spinner--sm" />
            <span className="text-sm font-semibold">Generating emails... This uses your Gemini API quota.</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: '100%', animation: 'shimmer 1.5s infinite' }} />
          </div>
        </div>
      )}

      <div className="emails__layout">
        {/* Recruiter List */}
        <div className="emails__sidebar glass-card">
          <div className="emails__search">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recruiters..."
              />
            </div>
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
              filtered.map((r) => {
                const rid = r.id || r._id;
                const isSelected = (selectedRecruiter?.id || selectedRecruiter?._id) === rid;
                const hasEmail = !!emailMap[rid] || statusMap[rid]?.hasEmail;
                const recruiterStatus = statusMap[rid]?.status;
                return (
                  <div
                    key={rid}
                    className={`emails__list-item ${isSelected ? 'emails__list-item--active' : ''}`}
                    onClick={() => handleSelectRecruiter(r)}
                  >
                    <div className="emails__list-item-info">
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
              })
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
