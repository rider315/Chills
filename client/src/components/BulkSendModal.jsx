import React, { useEffect, useRef } from 'react';

/**
 * Premium confirmation modal for bulk email sending.
 * Shows a detailed preview of recipients before sending.
 */
export default function BulkSendModal({ isOpen, onClose, onConfirm, targets = [], type = 'send' }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  const isSend = type === 'send';
  const displayTargets = targets.slice(0, 8);
  const remaining = targets.length - displayTargets.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md bg-bw border-4 border-border rounded-base flex flex-col overflow-hidden"
        style={{
          boxShadow: '8px 8px 0 0 rgba(0,0,0,1)',
          animation: 'bulkModalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b-4 border-border"
          style={{ background: isSend ? '#75FA92' : '#ffd800' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{isSend ? '📤' : '⚡'}</span>
            <div>
              <h3 className="text-xl font-black m-0 leading-tight">
                {isSend ? 'Send Emails' : 'Generate Emails'}
              </h3>
              <p className="text-sm font-bold opacity-70 m-0">
                {targets.length} recruiter{targets.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center font-black text-xl hover:bg-bw border-2 border-transparent hover:border-border rounded-full transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Warning Banner */}
        <div className="px-5 pt-4 pb-2">
          <div
            className="flex items-start gap-3 p-3 rounded-base border-2 border-border"
            style={{ background: isSend ? '#FFF3CD' : '#E8F4FD' }}
          >
            <span className="text-lg flex-shrink-0">{isSend ? '⚠️' : 'ℹ️'}</span>
            <p className="text-sm font-bold m-0 leading-snug">
              {isSend
                ? `This will send personalized emails to ${targets.length} recruiter${targets.length !== 1 ? 's' : ''}. Emails will be sent from your configured account with a 2.5s delay between each.`
                : `AI will generate personalized emails for ${targets.length} recruiter${targets.length !== 1 ? 's' : ''}. You can review and edit them before sending.`
              }
            </p>
          </div>
        </div>

        {/* Recipients Preview */}
        <div className="px-5 py-3">
          <p className="text-xs font-black uppercase tracking-wider opacity-60 mb-2">
            Recipients
          </p>
          <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
            {displayTargets.map((r, i) => {
              const rid = r.id || r._id;
              return (
                <div
                  key={rid}
                  className="flex items-center gap-3 p-2.5 rounded-base border-2 border-border bg-gray-50 hover:bg-gray-100 transition-colors"
                  style={{
                    animation: `bulkModalItemFade 0.3s ${i * 0.04}s both`
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 border-border flex-shrink-0"
                    style={{
                      background: `hsl(${(rid?.charCodeAt?.(0) || i) * 37 % 360}, 70%, 85%)`
                    }}
                  >
                    {(r.recruiterName || r.name || r.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{r.company || 'Unknown Company'}</div>
                    <div className="text-xs opacity-60 truncate">{r.recruiterName || r.name || r.email}</div>
                  </div>
                  <span className="text-xs opacity-40 flex-shrink-0">#{i + 1}</span>
                </div>
              );
            })}
            {remaining > 0 && (
              <div className="flex items-center justify-center p-2 rounded-base border-2 border-dashed border-gray-300 text-sm font-bold opacity-60">
                +{remaining} more recruiter{remaining !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Estimated Time */}
        {isSend && targets.length > 1 && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold opacity-50">
              <span>⏱</span>
              <span>Estimated time: ~{Math.ceil(targets.length * 3 / 60)} min{Math.ceil(targets.length * 3 / 60) !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t-4 border-border bg-gray-50 flex items-center justify-between gap-3">
          <button
            className="btn-neo btn-neo-white px-5 py-2.5 text-sm font-black"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn-neo px-6 py-2.5 text-sm font-black border-2 border-border transition-transform active:translate-x-1 active:translate-y-1"
            style={{
              background: isSend ? '#75FA92' : '#ffd800',
              boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
            }}
            onClick={onConfirm}
          >
            {isSend
              ? `📤 Send ${targets.length} Email${targets.length !== 1 ? 's' : ''}`
              : `⚡ Generate ${targets.length} Email${targets.length !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes bulkModalSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bulkModalItemFade {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
