import React, { useState, useEffect } from 'react';
import { post, get } from '../utils/api';
import { useToast } from './Toast';

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
    <div className="fixed inset-0 z-50 flex justify-end p-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card-neo h-full w-full max-w-md bg-bw border-l-4 border-r-0 border-y-0 p-0 flex flex-col shadow-neolg animate-slideUp sm:border-y-4 sm:border-r-4 sm:h-auto sm:my-4 sm:mr-4 sm:max-h-[calc(100vh-2rem)] sm:rounded-base">
        <div className="flex items-center justify-between p-4 border-b-4 border-border bg-neo-yellow">
          <h3 className="text-xl font-black">💬 Reply Analysis</h3>
          <button className="w-8 h-8 flex items-center justify-center font-black text-xl hover:bg-bw border-2 border-transparent hover:border-border rounded-full transition-colors" onClick={onClose}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          {/* Input */}
          <div className="flex flex-col gap-3">
            <label className="font-black uppercase tracking-widest text-xs opacity-70">Paste recruiter's reply</label>
            <textarea
              className="input-neo min-h-[150px] resize-y"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Paste the recruiter's email reply here..."
              rows={5}
            />
            <button
              className="btn-neo btn-neo-blue w-full"
              onClick={handleAnalyze}
              disabled={analyzing || !replyText.trim()}
            >
              {analyzing ? (
                <>
                  <span className="animate-spin inline-block mr-2">⏳</span>
                  Analyzing...
                </>
              ) : (
                '🔍 Analyze Reply'
              )}
            </button>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="flex flex-col gap-4 animate-slideUp">
              <h4 className="text-lg font-black border-b-2 border-border pb-2">Analysis</h4>
              {analysis.intent && (
                <div className="flex flex-col gap-1">
                  <span className="font-black uppercase tracking-widest text-xs opacity-70">Intent</span>
                  <span className={`px-3 py-1 text-sm font-bold uppercase tracking-wider rounded border-2 border-border shadow-neosm w-max ${analysis.intent === 'positive' ? 'bg-neo-green' : analysis.intent === 'negative' ? 'bg-neo-red text-bw' : 'bg-neo-yellow'}`}>
                    {analysis.intent}
                  </span>
                </div>
              )}
              {analysis.suggestedReply && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black uppercase tracking-widest text-xs opacity-70">Suggested Reply</span>
                    <button className="font-bold text-sm uppercase tracking-wider hover:underline" onClick={handleCopySuggested}>
                      📋 Copy
                    </button>
                  </div>
                  <div className="p-4 bg-gray-50 border-2 border-border rounded-base font-medium whitespace-pre-wrap text-sm leading-relaxed">
                    {analysis.suggestedReply}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reply History */}
          {replies.length > 0 && (
            <div className="flex flex-col gap-4">
              <h4 className="text-lg font-black border-b-2 border-border pb-2">Reply History</h4>
              <div className="flex flex-col gap-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-1 before:bg-gray-200">
                {replies.map((reply, i) => (
                  <div key={reply.id || i} className="flex flex-col gap-2 pl-6 relative before:absolute before:left-1 before:top-1 before:w-3 before:h-3 before:bg-neo-blue before:rounded-full before:border-2 before:border-bw">
                    <div className="font-black text-xs uppercase opacity-50">
                      {new Date(reply.createdAt || reply.date).toLocaleDateString()}
                    </div>
                    <div className="p-3 bg-gray-50 border-2 border-border rounded text-sm font-medium whitespace-pre-wrap">
                      {reply.replyText || reply.text}
                    </div>
                    {reply.intent && (
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded border-2 border-border shadow-neosm w-max ${reply.intent === 'positive' ? 'bg-neo-green' : reply.intent === 'negative' ? 'bg-neo-red text-bw' : 'bg-neo-yellow'}`}>
                        {reply.intent}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
