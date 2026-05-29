import React, { useState, useRef, useEffect } from 'react';
import StatusBadge from './StatusBadge';
import './EmailPreview.css';

export default function EmailPreview({
  email,
  recruiter,
  status,
  loading,
  onSend,
  onCopy,
  onRegenerate,
  onSave,
  onStatusChange,
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (email) {
      setSubject(email.subject || '');
      setBody(email.body || '');
    }
  }, [email]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [body, editing]);

  const handleSave = () => {
    onSave?.({ subject, body });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="email-preview glass-card">
        <div className="email-preview__shimmer">
          <div className="skeleton skeleton-title" style={{ width: '60%' }} />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" style={{ width: '80%' }} />
          <div style={{ height: 20 }} />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" style={{ width: '45%' }} />
          <div style={{ height: 20 }} />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text" style={{ width: '70%' }} />
        </div>
        <div className="email-preview__generating">
          <div className="spinner spinner--sm" />
          <span>AI is crafting your email…</span>
        </div>
      </div>
    );
  }

  if (!email && !recruiter) {
    return (
      <div className="email-preview glass-card">
        <div className="empty-state">
          <div className="empty-state__icon">✉️</div>
          <div className="empty-state__title">Select a Recruiter</div>
          <div className="empty-state__desc">
            Choose a recruiter from the list to preview or generate their personalized email.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="email-preview glass-card">
      {/* Header */}
      <div className="email-preview__header">
        <div className="email-preview__header-info">
          <h3 className="email-preview__company">{recruiter?.company || 'Company'}</h3>
          <div className="email-preview__recruiter">
            <span className="email-preview__recruiter-name">
              {recruiter?.recruiterName || recruiter?.name || 'Recruiter'}
            </span>
            <span className="email-preview__recruiter-email">{recruiter?.email}</span>
          </div>
        </div>
        {status && (
          <StatusBadge status={status} onChange={onStatusChange} clickable={!!onStatusChange} />
        )}
      </div>

      {/* Subject */}
      <div className="email-preview__field">
        <label className="email-preview__field-label">Subject</label>
        {editing ? (
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject..."
          />
        ) : (
          <div className="email-preview__subject">{subject || 'No subject'}</div>
        )}
      </div>

      {/* Body */}
      <div className="email-preview__field">
        <label className="email-preview__field-label">Body</label>
        {editing ? (
          <textarea
            ref={textareaRef}
            className="textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Email body..."
          />
        ) : (
          <div className="email-preview__body">{body || 'No content generated yet.'}</div>
        )}
      </div>

      {/* Company Research */}
      {email?.companyResearch && (
        <div className="email-preview__research">
          <button
            className="email-preview__research-toggle"
            onClick={() => setShowResearch(!showResearch)}
          >
            <span>🔍 Company Research</span>
            <span className={`email-preview__chevron ${showResearch ? 'email-preview__chevron--open' : ''}`}>▾</span>
          </button>
          {showResearch && (
            <div className="email-preview__research-content">
              {typeof email.companyResearch === 'string'
                ? email.companyResearch
                : Object.entries(email.companyResearch).map(([key, val]) => (
                    <div key={key} className="email-preview__research-item">
                      <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</strong>{' '}
                      <span>{Array.isArray(val) ? val.filter(Boolean).join(', ') || '—' : val || '—'}</span>
                    </div>
                  ))}
            </div>
          )}
        </div>
      )}

      {/* Suggested time */}
      {email?.suggestedSendTime && (
        <div className="email-preview__send-time">
          <span>🕐</span>
          <span>Suggested send time: <strong>{email.suggestedSendTime}</strong></span>
        </div>
      )}

      {/* Actions */}
      <div className="email-preview__actions">
        {editing ? (
          <>
            <button className="btn btn-primary" onClick={handleSave}>💾 Save</button>
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setSubject(email?.subject || ''); setBody(email?.body || ''); }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {email && (
              <>
                <button className="btn btn-primary" onClick={onSend}>📤 Send</button>
                <button className="btn btn-secondary" onClick={onCopy}>📋 Copy</button>
                <button className="btn btn-ghost" onClick={() => setEditing(true)}>✏️ Edit</button>
              </>
            )}
            <button className="btn btn-ghost" onClick={onRegenerate}>
              🔄 {email ? 'Regenerate' : 'Generate'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
