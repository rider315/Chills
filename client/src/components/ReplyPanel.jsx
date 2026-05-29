import React, { useState, useEffect } from 'react';
import { post, get } from '../utils/api';
import { useToast } from './Toast';
import './ReplyPanel.css';

export default function ReplyPanel({ applicationId, isOpen, onClose }) {
  const toast = useToast();
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (isOpen && applicationId) {
      fetchReplies();
    }
  }, [isOpen, applicationId]);

  const fetchReplies = async () => {
    try {
      const data = await get(`/api/replies/${applicationId}`);
      setReplies(data.replies || data || []);
    } catch (err) {
      console.error('Failed to fetch replies:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!replyText.trim()) return;
    setAnalyzing(true);
    try {
      const data = await post(`/api/replies/${applicationId}`, { replyText });
      setAnalysis(data);
      setReplyText('');
      fetchReplies();
      toast.success('Reply analyzed successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to analyze reply');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopySuggested = () => {
    if (analysis?.suggestedReply) {
      navigator.clipboard.writeText(analysis.suggestedReply);
      toast.success('Suggested reply copied!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="reply-panel-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="reply-panel glass-card">
        <div className="reply-panel__header">
          <h3>💬 Reply Analysis</h3>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>

        <div className="reply-panel__body">
          {/* Input */}
          <div className="reply-panel__input-section">
            <label className="form-label">Paste recruiter's reply</label>
            <textarea
              className="textarea"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Paste the recruiter's email reply here..."
              rows={5}
            />
            <button
              className="btn btn-primary w-full"
              onClick={handleAnalyze}
              disabled={analyzing || !replyText.trim()}
            >
              {analyzing ? (
                <>
                  <span className="spinner spinner--sm" />
                  Analyzing...
                </>
              ) : (
                '🔍 Analyze Reply'
              )}
            </button>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="reply-panel__analysis">
              <h4>Analysis</h4>
              {analysis.intent && (
                <div className="reply-panel__intent">
                  <span className="form-label">Intent</span>
                  <span className={`badge badge--${analysis.intent === 'positive' ? 'offer' : analysis.intent === 'negative' ? 'rejected' : 'viewed'}`}>
                    {analysis.intent}
                  </span>
                </div>
              )}
              {analysis.suggestedReply && (
                <div className="reply-panel__suggested">
                  <div className="flex items-center justify-between mb-xs">
                    <span className="form-label">Suggested Reply</span>
                    <button className="btn btn-ghost btn-sm" onClick={handleCopySuggested}>
                      📋 Copy
                    </button>
                  </div>
                  <div className="reply-panel__suggested-text">
                    {analysis.suggestedReply}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reply History */}
          {replies.length > 0 && (
            <div className="reply-panel__history">
              <h4>Reply History</h4>
              {replies.map((reply, i) => (
                <div key={reply.id || i} className="reply-panel__history-item">
                  <div className="reply-panel__history-date">
                    {new Date(reply.createdAt || reply.date).toLocaleDateString()}
                  </div>
                  <div className="reply-panel__history-text">{reply.replyText || reply.text}</div>
                  {reply.intent && (
                    <span className={`badge badge--${reply.intent === 'positive' ? 'offer' : 'viewed'}`}>
                      {reply.intent}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
