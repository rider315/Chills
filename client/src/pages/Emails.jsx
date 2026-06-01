import React, { useState, useEffect } from 'react';
import { get, post, put } from '../utils/api';
import { useToast } from '../components/Toast';
import EmailPreview from '../components/EmailPreview';

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
  const [usageStats, setUsageStats] = useState(null); // Freemium limits

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recruiterData, statusData, usageData] = await Promise.all([
        get('/api/recruiters'),
        get('/api/emails/status'),
        get('/api/usage/status')
      ]);
      setRecruiters(recruiterData?.recruiters || recruiterData || []);
      setStatusMap(statusData?.statusMap || {});
      setUsageStats(usageData || null);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    try {
      const res = await post('/api/usage/upgrade');
      toast.success(res.message || 'Upgraded successfully!');
      fetchData(); // refresh stats
    } catch (err) {
      toast.error('Upgrade failed: ' + err.message);
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
    fetchData(); // Refresh usage stats
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
      fetchData(); // Refresh usage stats
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

  const outOfQuota = usageStats && !usageStats.isPremium && usageStats.emailsSent >= usageStats.limit;

  return (
    <div className="flex flex-col gap-8 animate-fadeIn h-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b-4 border-border pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            <span className="bg-neo-blue text-bw px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Emails</span> ✉️
          </h1>
          <p className="text-xl font-bold opacity-80 mt-4">Generate personalized cold emails for each recruiter.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {selectedRecruiters.length > 0 && (
            <>
              <button className="btn-neo bg-neo-green text-text px-4 py-2" onClick={() => handleSendBulk(true)} disabled={sendingBulk || outOfQuota}>
                📤 Send Selected ({selectedRecruiters.length})
              </button>
              <button className="btn-neo bg-neo-yellow text-text px-4 py-2" onClick={() => handleGenerateBulk(true)} disabled={generatingBulk}>
                ⚡ Generate Selected ({selectedRecruiters.length})
              </button>
            </>
          )}
          <button
            className="btn-neo btn-neo-white"
            onClick={() => handleSendBulk(false)}
            disabled={sendingBulk || generatedCount === 0 || outOfQuota}
          >
            {sendingBulk ? 'Sending...' : '📤 Send All'}
          </button>
          <button
            className="btn-neo btn-neo-blue"
            onClick={() => handleGenerateBulk(false)}
            disabled={generatingBulk || recruiters.length === 0}
          >
            {generatingBulk ? 'Generating...' : '⚡ Generate All'}
          </button>
        </div>
      </div>

      {/* Generation Stats Banner */}
      {totalRecruiters > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-neo bg-bw flex flex-col items-center justify-center p-4">
            <span className="text-3xl font-black">{totalRecruiters}</span>
            <span className="text-sm font-bold uppercase tracking-wider opacity-70">Recruiters</span>
          </div>
          <div className="card-neo bg-neo-yellow flex flex-col items-center justify-center p-4">
            <span className="text-3xl font-black">{generatedCount}</span>
            <span className="text-sm font-bold uppercase tracking-wider opacity-70">Generated</span>
          </div>
          <div className="card-neo bg-neo-red text-bw flex flex-col items-center justify-center p-4">
            <span className="text-3xl font-black">{totalRecruiters - generatedCount}</span>
            <span className="text-sm font-bold uppercase tracking-wider opacity-70 text-white">Pending</span>
          </div>
          <div className="card-neo bg-neo-green flex flex-col items-center justify-center p-4">
            <span className="text-3xl font-black">{sentCount}</span>
            <span className="text-sm font-bold uppercase tracking-wider opacity-70">Sent</span>
          </div>
        </div>
      )}

      {/* Freemium Banner */}
      {usageStats && (
        <div className={`card-neo p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-4 ${usageStats.isPremium ? 'bg-neo-green text-bw' : outOfQuota ? 'bg-neo-red text-bw' : 'bg-neo-yellow'}`}>
          <div className="flex items-center gap-4">
            <span className="text-4xl">{usageStats.isPremium ? '👑' : outOfQuota ? '🛑' : '🚀'}</span>
            <div>
              <h3 className="text-xl font-black uppercase tracking-wider">
                {usageStats.isPremium ? 'Premium Active' : 'Free Tier'}
              </h3>
              <p className="font-bold opacity-90">
                {usageStats.isPremium 
                  ? 'You have unlimited email sending capabilities.' 
                  : `You have sent ${usageStats.emailsSent} out of ${usageStats.limit} free emails.`}
              </p>
            </div>
          </div>
          {!usageStats.isPremium && (
            <button className="btn-neo bg-bw text-text w-full md:w-auto" onClick={handleUpgrade}>
              💎 Upgrade to Premium
            </button>
          )}
        </div>
      )}

      {bulkProgress.active && (
        <div className="card-neo bg-neo-purple text-bw p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">
                {bulkProgress.type === 'generate' ? 'Generating email for ' : 'Sending email to '}
                <span className="text-neo-yellow px-1">{bulkProgress.company}</span>...
              </span>
            </div>
            <span className="text-lg font-black">
              {bulkProgress.current} / {bulkProgress.total}
            </span>
          </div>
          <div className="h-4 bg-bw border-2 border-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-neo-yellow transition-all duration-300" 
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} 
            />
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[600px]">
        {/* Recruiter List */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
              <input
                className="input-neo pl-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recruiters..."
              />
            </div>
            <select 
              className="input-neo w-full sm:w-auto font-bold cursor-pointer"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Not Generated</option>
              <option value="draft">Generated (Draft)</option>
              <option value="sent">Sent</option>
            </select>
          </div>

          <div className="card-neo flex-1 overflow-y-auto max-h-[800px] bg-bw p-0 flex flex-col border-4">
            {loading ? (
              <div className="p-4 flex flex-col gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex flex-col gap-2">
                    <div className="h-6 bg-gray-200 rounded w-3/4 border-2 border-border" />
                    <div className="h-4 bg-gray-200 rounded w-1/2 border-2 border-border" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center opacity-70">
                <div className="text-4xl mb-4">👥</div>
                <div className="font-bold text-lg uppercase">No recruiters found</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 border-b-4 border-border bg-gray-50">
                  <button className="font-bold text-sm hover:underline" onClick={toggleSelectAll}>
                    {selectedRecruiters.length === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedRecruiters.length > 0 && <span className="text-xs font-black bg-neo-yellow px-2 py-1 rounded border-2 border-border">{selectedRecruiters.length} selected</span>}
                </div>
                <div className="flex flex-col divide-y-4 divide-border">
                  {filtered.map((r) => {
                    const rid = r.id || r._id;
                    const isPreviewSelected = (selectedRecruiter?.id || selectedRecruiter?._id) === rid;
                    const isChecked = selectedRecruiters.includes(rid);
                    const hasEmail = !!emailMap[rid] || statusMap[rid]?.hasEmail;
                    const recruiterStatus = statusMap[rid]?.status;
                    return (
                      <div
                        key={rid}
                        className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${isPreviewSelected ? 'bg-neo-blue text-bw' : 'hover:bg-gray-100'} ${isChecked && !isPreviewSelected ? 'bg-blue-50' : ''}`}
                        onClick={() => handleSelectRecruiter(r)}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => { e.stopPropagation(); toggleSelection(rid); }}
                          className="mt-1 w-5 h-5 cursor-pointer accent-neo-yellow border-2 border-border rounded-sm flex-shrink-0"
                        />
                        <div className="flex-1 flex flex-col min-w-0">
                          <span className="font-black text-lg truncate">{r.company}</span>
                          <span className={`text-sm font-bold truncate ${isPreviewSelected ? 'opacity-90' : 'opacity-70'}`}>{r.recruiterName || r.name || 'No Name'}</span>
                          <span className={`text-xs truncate mt-1 ${isPreviewSelected ? 'opacity-80' : 'opacity-60'}`}>{r.email}</span>
                        </div>
                        <div className="flex-shrink-0 text-xl" title={recruiterStatus === 'sent' ? 'Sent' : hasEmail ? 'Email generated' : 'Not generated yet'}>
                          {recruiterStatus === 'sent' ? '📤' : hasEmail ? '✅' : '⬜'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Email Preview */}
        <div className="w-full lg:w-2/3">
          <EmailPreview
            email={email}
            recruiter={selectedRecruiter}
            loading={generating}
            onSend={handleSend}
            onCopy={handleCopy}
            onRegenerate={handleGenerate}
            onSave={handleSave}
            outOfQuota={outOfQuota}
            onUpgrade={handleUpgrade}
          />
        </div>
      </div>
    </div>
  );
}
