import React, { useState, useEffect } from 'react';
import { get, put } from '../utils/api';
import { useToast } from '../components/Toast';
import PipelineView from '../components/PipelineView';
import StatusBadge from '../components/StatusBadge';
import ReplyPanel from '../components/ReplyPanel';
import { STATUS_STAGES, STATUS_LABELS, STATUS_ICONS } from '../utils/constants';
import './Applications.css';

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
    <div className="page-enter applications">
      <div className="applications__header">
        <div>
          <h1 className="applications__title">
            <span className="text-gradient">Applications</span> 📋
          </h1>
          <p className="text-muted text-sm">{applications.length} total application{applications.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="applications__header-actions">
          <div className="tabs" style={{ width: 'auto' }}>
            <button
              className={`tab ${view === 'pipeline' ? 'tab--active' : ''}`}
              onClick={() => setView('pipeline')}
            >
              🏗️ Pipeline
            </button>
            <button
              className={`tab ${view === 'table' ? 'tab--active' : ''}`}
              onClick={() => setView('table')}
            >
              📋 Table
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="applications__filters">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, email..."
          />
        </div>
        <div className="applications__status-chips">
          <button
            className={`chip ${statusFilter === 'all' ? 'chip--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
          {STATUS_STAGES.map((s) => (
            <button
              key={s}
              className={`chip ${statusFilter === s ? 'chip--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_ICONS[s]} {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner--lg" />
        </div>
      ) : applications.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__title">No Applications Yet</div>
            <div className="empty-state__desc">Generate emails first and they'll appear here.</div>
          </div>
        </div>
      ) : view === 'pipeline' ? (
        <PipelineView
          applications={filtered}
          onStatusChange={handleStatusChange}
          onCardClick={(app) => setSelectedApp(app)}
        />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th onClick={() => handleSort('company')} style={{ cursor: 'pointer' }}>
                  Company {sortField === 'company' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Recruiter</th>
                <th>Status</th>
                <th onClick={() => handleSort('sentAt')} style={{ cursor: 'pointer' }}>
                  Sent {sortField === 'sentAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th onClick={() => handleSort('updatedAt')} style={{ cursor: 'pointer' }}>
                  Updated {sortField === 'updatedAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr
                  key={app.id || app._id}
                  onClick={() => setSelectedApp(selectedApp?.id === app.id ? null : app)}
                  className={selectedApp && (selectedApp.id || selectedApp._id) === (app.id || app._id) ? 'table-row--active' : ''}
                >
                  <td>
                    <span className="font-semibold">{app.company || app.recruiter?.company || '—'}</span>
                  </td>
                  <td className="text-muted">{app.recruiterEmail || app.recruiter?.email || '—'}</td>
                  <td>
                    <StatusBadge
                      status={app.status || 'draft'}
                      onChange={(s) => handleStatusChange(app.id || app._id, s)}
                      clickable
                    />
                  </td>
                  <td className="text-muted">{formatDate(app.sentAt)}</td>
                  <td className="text-muted">{formatDate(app.updatedAt)}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
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
      )}

      {/* Expanded Detail */}
      {selectedApp && view === 'pipeline' && (
        <div className="applications__detail glass-card mt-lg p-lg">
          <div className="flex items-center justify-between mb-md">
            <h3>{selectedApp.company || 'Application Detail'}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedApp(null)}>✕ Close</button>
          </div>
          <div className="flex gap-md mb-md flex-wrap">
            <div>
              <span className="text-xs text-muted">Recruiter</span>
              <div className="text-sm font-semibold">{selectedApp.recruiterEmail || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-muted">Status</span>
              <div>
                <StatusBadge
                  status={selectedApp.status || 'draft'}
                  onChange={(s) => handleStatusChange(selectedApp.id || selectedApp._id, s)}
                  clickable
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted">Created</span>
              <div className="text-sm">{formatDate(selectedApp.createdAt)}</div>
            </div>
          </div>
          {selectedApp.emailSubject && (
            <div className="mb-md">
              <span className="text-xs text-muted">Email Subject</span>
              <div className="text-sm font-semibold">{selectedApp.emailSubject}</div>
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
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
