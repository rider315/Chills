import React, { useState, useRef, useEffect } from 'react';
import StatusBadge from './StatusBadge';

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
  outOfQuota,
  onUpgrade
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
      <div className="card-neo flex flex-col h-full bg-bw p-6 border-4">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 bg-gray-200 rounded w-1/2 border-2 border-border mb-4" />
          <div className="h-4 bg-gray-200 rounded w-3/4 border-2 border-border" />
          <div className="h-4 bg-gray-200 rounded w-5/6 border-2 border-border" />
          <div className="h-4 bg-gray-200 rounded w-2/3 border-2 border-border" />
          <div className="h-10 mt-4" />
          <div className="h-4 bg-gray-200 rounded w-full border-2 border-border" />
          <div className="h-4 bg-gray-200 rounded w-4/5 border-2 border-border" />
          <div className="h-4 bg-gray-200 rounded w-1/2 border-2 border-border" />
        </div>
        <div className="mt-auto flex items-center justify-center gap-3 p-4 bg-neo-yellow border-2 border-border rounded-base shadow-neosm">
          <span className="text-xl animate-spin">⏳</span>
          <span className="font-black text-lg">AI is crafting your email…</span>
        </div>
      </div>
    );
  }

  if (!email && !recruiter) {
    return (
      <div className="card-neo flex flex-col items-center justify-center h-full min-h-[400px] bg-bw p-6 border-4 text-center">
        <div className="text-6xl mb-4">✉️</div>
        <div className="text-2xl font-black uppercase tracking-widest mb-2">Select a Recruiter</div>
        <div className="text-lg font-medium opacity-70 max-w-sm">
          Choose a recruiter from the list to preview or generate their personalized email.
        </div>
      </div>
    );
  }

  return (
    <div className="card-neo flex flex-col h-full bg-bw p-6 border-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-4 border-border pb-4 mb-4">
        <div className="flex flex-col">
          <h3 className="text-2xl font-black mb-1">{recruiter?.company || 'Company'}</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold opacity-80">
            <span className="uppercase tracking-wider">
              {recruiter?.recruiterName || recruiter?.name || 'Recruiter'}
            </span>
            {recruiter?.email && (
              <>
                <span>•</span>
                <span className="bg-gray-100 px-2 py-0.5 rounded border-2 border-border shadow-neosm">{recruiter.email}</span>
              </>
            )}
          </div>
        </div>
        {status && (
          <div className="self-start">
            <StatusBadge status={status} onChange={onStatusChange} clickable={!!onStatusChange} />
          </div>
        )}
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-2 mb-6">
        <label className="font-black uppercase tracking-widest text-sm opacity-80">Subject</label>
        {editing ? (
          <input
            className="input-neo w-full text-lg font-bold"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject..."
          />
        ) : (
          <div className="text-lg font-bold p-3 bg-gray-50 border-2 border-border rounded-base">
            {subject || 'No subject'}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 flex-1 mb-6 min-h-[200px]">
        <label className="font-black uppercase tracking-widest text-sm opacity-80">Body</label>
        {editing ? (
          <textarea
            ref={textareaRef}
            className="input-neo w-full h-full min-h-[300px] resize-y font-medium whitespace-pre-wrap leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Email body..."
          />
        ) : (
          <div className="flex-1 p-4 bg-gray-50 border-2 border-border rounded-base font-medium whitespace-pre-wrap leading-relaxed overflow-y-auto">
            {body || 'No content generated yet.'}
          </div>
        )}
      </div>

      {/* Company Research */}
      {email?.companyResearch && (
        <div className="mb-6">
          <button
            className="flex items-center gap-2 font-black uppercase tracking-widest text-sm opacity-80 hover:opacity-100 transition-opacity"
            onClick={() => setShowResearch(!showResearch)}
          >
            <span>🔍 Company Research</span>
            <span className={`transition-transform ${showResearch ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showResearch && (
            <div className="mt-2 p-4 bg-neo-yellow text-text border-2 border-border rounded-base shadow-neosm flex flex-col gap-2 font-medium text-sm">
              {typeof email.companyResearch === 'string'
                ? email.companyResearch
                : Object.entries(email.companyResearch).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <strong className="uppercase">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</strong>
                      <span>{Array.isArray(val) ? val.filter(Boolean).join(', ') || '—' : val || '—'}</span>
                    </div>
                  ))}
            </div>
          )}
        </div>
      )}

      {/* Suggested time */}
      {email?.suggestedSendTime && (
        <div className="flex items-center gap-2 text-sm font-bold bg-neo-blue text-bw p-3 rounded-base border-2 border-border shadow-neosm mb-6 w-max">
          <span>🕐</span>
          <span>Suggested send time: <strong>{email.suggestedSendTime}</strong></span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mt-auto pt-4 border-t-4 border-border">
        {editing ? (
          <>
            <button className="btn-neo btn-neo-green px-6" onClick={handleSave}>💾 Save</button>
            <button className="font-bold hover:underline" onClick={() => { setEditing(false); setSubject(email?.subject || ''); setBody(email?.body || ''); }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {email && (
              <>
                {outOfQuota ? (
                  <button className="btn-neo bg-neo-red text-bw px-6" onClick={onUpgrade}>
                    🛑 Upgrade to Send
                  </button>
                ) : (
                  <button className="btn-neo btn-neo-green px-6" onClick={onSend}>📤 Send</button>
                )}
                <button className="btn-neo btn-neo-white px-6" onClick={onCopy}>📋 Copy</button>
                <button className="btn-neo btn-neo-blue px-6" onClick={() => setEditing(true)}>✏️ Edit</button>
              </>
            )}
            <button className="font-bold text-sm uppercase tracking-wider ml-auto hover:underline" onClick={onRegenerate}>
              🔄 {email ? 'Regenerate' : 'Generate'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
