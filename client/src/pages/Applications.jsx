import React, { useState, useEffect } from 'react';
import { get, put } from '../utils/api';
import { useToast } from '../components/Toast';
import PipelineView from '../components/PipelineView';
import StatusBadge from '../components/StatusBadge';
import ReplyPanel from '../components/ReplyPanel';
import { STATUS_STAGES, STATUS_LABELS, STATUS_ICONS } from '../utils/constants';

export default function Applications() {
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pipeline');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [replyPanelApp, setReplyPanelApp] = useState(null);
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await get('/api/applications');
      setApplications(data?.applications || data || []);
    } catch (err) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId, newStatus) => {
    try {
      await put(`/api/applications/${appId}/status`, { status: newStatus });
      setApplications((prev) =>
        prev.map((a) => ((a.id || a._id) === appId ? { ...a, status: newStatus } : a))
      );
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  let filtered = applications.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      (a.company || '').toLowerCase().includes(q) ||
      (a.recruiterEmail || a.recruiter?.email || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || (a.status || 'draft') === statusFilter;
    return matchSearch && matchStatus;
  });

  // Sort
  filtered.sort((a, b) => {
    let aVal = a[sortField] || '';
    let bVal = b[sortField] || '';
    if (sortField.includes('At') || sortField.includes('Date')) {
      aVal = new Date(aVal || 0).getTime();
      bVal = new Date(bVal || 0).getTime();
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-8 animate-fadeIn h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-border pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            <span className="bg-neo-green text-text px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Applications</span> 📋
          </h1>
          <p className="text-xl font-bold opacity-80 mt-4">{applications.length} total application{applications.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-4 border-4 border-border rounded-base p-1 bg-bw shadow-neosm w-max">
          <button
            className={`px-6 py-2 font-black tracking-widest uppercase transition-colors rounded ${view === 'pipeline' ? 'bg-neo-purple text-bw' : 'hover:bg-gray-100'}`}
            onClick={() => setView('pipeline')}
          >
            🏗️ Pipeline
          </button>
          <button
            className={`px-6 py-2 font-black tracking-widest uppercase transition-colors rounded ${view === 'table' ? 'bg-neo-purple text-bw' : 'hover:bg-gray-100'}`}
            onClick={() => setView('table')}
          >
            📋 Table
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-1/3 min-w-[250px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">🔍</span>
          <input
            className="input-neo pl-10 w-full font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, email..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-4 py-2 font-bold uppercase tracking-wider rounded-full border-2 border-border transition-transform hover:-translate-y-0.5 ${statusFilter === 'all' ? 'bg-bw shadow-neosm' : 'bg-transparent text-gray-500 hover:text-black border-transparent'}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          {STATUS_STAGES.map((s) => (
            <button
              key={s}
              className={`px-4 py-2 font-bold uppercase tracking-wider rounded-full border-2 border-border transition-transform hover:-translate-y-0.5 ${statusFilter === s ? 'bg-bw shadow-neosm' : 'bg-transparent text-gray-500 hover:text-black border-transparent'}`}
              onClick={() => setStatusFilter(s)}
            >
              <span className="mr-2">{STATUS_ICONS[s]}</span>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <span className="text-4xl animate-spin">⏳</span>
        </div>
      ) : applications.length === 0 ? (
        <div className="card-neo flex flex-col items-center justify-center py-20 text-center bg-bw border-4">
          <div className="text-6xl mb-4">📋</div>
          <div className="text-3xl font-black uppercase tracking-widest mb-2">No Applications Yet</div>
          <div className="text-lg font-medium opacity-70">Generate emails first and they'll appear here.</div>
        </div>
      ) : view === 'pipeline' ? (
        <div className="flex-1 w-full overflow-hidden">
          <PipelineView
            applications={filtered}
            onStatusChange={handleStatusChange}
            onCardClick={(app) => setSelectedApp(app)}
          />
        </div>
      ) : (
        <div className="card-neo bg-bw border-4 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-4 border-border">
                  <th className="p-4 font-black uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('company')}>
                    Company {sortField === 'company' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="p-4 font-black uppercase tracking-widest whitespace-nowrap">Recruiter</th>
                  <th className="p-4 font-black uppercase tracking-widest whitespace-nowrap">Status</th>
                  <th className="p-4 font-black uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('sentAt')}>
                    Sent {sortField === 'sentAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="p-4 font-black uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-200" onClick={() => handleSort('updatedAt')}>
                    Updated {sortField === 'updatedAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="p-4 font-black uppercase tracking-widest whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-border">
                {filtered.map((app) => (
                  <tr
                    key={app.id || app._id}
                    onClick={() => setSelectedApp(selectedApp?.id === app.id ? null : app)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50 ${selectedApp && (selectedApp.id || selectedApp._id) === (app.id || app._id) ? 'bg-neo-blue text-bw hover:bg-neo-blue' : ''}`}
                  >
                    <td className="p-4">
                      <span className="font-black text-lg">{app.company || app.recruiter?.company || '—'}</span>
                    </td>
                    <td className={`p-4 font-bold ${selectedApp && (selectedApp.id || selectedApp._id) === (app.id || app._id) ? 'opacity-90' : 'opacity-70'}`}>
                      {app.recruiterEmail || app.recruiter?.email || '—'}
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        status={app.status || 'draft'}
                        onChange={(s) => handleStatusChange(app.id || app._id, s)}
                        clickable
                      />
                    </td>
                    <td className={`p-4 font-bold ${selectedApp && (selectedApp.id || selectedApp._id) === (app.id || app._id) ? 'opacity-90' : 'opacity-70'}`}>
                      {formatDate(app.sentAt)}
                    </td>
                    <td className={`p-4 font-bold ${selectedApp && (selectedApp.id || selectedApp._id) === (app.id || app._id) ? 'opacity-90' : 'opacity-70'}`}>
                      {formatDate(app.updatedAt)}
                    </td>
                    <td className="p-4">
                      <button
                        className="btn-neo btn-neo-white text-xs px-3 py-1 text-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyPanelApp(app);
                        }}
                      >
                        💬 Reply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expanded Detail */}
      {selectedApp && view === 'pipeline' && (
        <div className="card-neo bg-bw border-4 p-6 mt-4">
          <div className="flex items-center justify-between mb-6 pb-4 border-b-4 border-border">
            <h3 className="text-2xl font-black">{selectedApp.company || 'Application Detail'}</h3>
            <button className="font-bold uppercase tracking-widest text-sm hover:underline" onClick={() => setSelectedApp(null)}>✕ Close</button>
          </div>
          <div className="flex flex-wrap gap-8 mb-6">
            <div className="flex flex-col gap-1">
              <span className="font-black uppercase tracking-widest text-xs opacity-70">Recruiter</span>
              <div className="font-bold bg-gray-100 px-3 py-1 rounded border-2 border-border shadow-neosm">{selectedApp.recruiterEmail || '—'}</div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-black uppercase tracking-widest text-xs opacity-70">Status</span>
              <div>
                <StatusBadge
                  status={selectedApp.status || 'draft'}
                  onChange={(s) => handleStatusChange(selectedApp.id || selectedApp._id, s)}
                  clickable
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-black uppercase tracking-widest text-xs opacity-70">Created</span>
              <div className="font-bold">{formatDate(selectedApp.createdAt)}</div>
            </div>
          </div>
          {selectedApp.emailSubject && (
            <div className="mb-6 flex flex-col gap-1">
              <span className="font-black uppercase tracking-widest text-xs opacity-70">Email Subject</span>
              <div className="font-bold text-lg p-3 bg-gray-50 border-2 border-border rounded-base">{selectedApp.emailSubject}</div>
            </div>
          )}
          <button
            className="btn-neo btn-neo-blue"
            onClick={() => setReplyPanelApp(selectedApp)}
          >
            💬 Add Reply
          </button>
        </div>
      )}

      <ReplyPanel
        applicationId={replyPanelApp?.id || replyPanelApp?._id}
        isOpen={!!replyPanelApp}
        onClose={() => setReplyPanelApp(null)}
      />
    </div>
  );
}
