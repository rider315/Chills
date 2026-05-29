import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../utils/api';
import StatsCard from '../components/StatsCard';
import PipelineView from '../components/PipelineView';
import StatusBadge from '../components/StatusBadge';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, appsData] = await Promise.all([
        get('/api/applications/stats').catch(() => null),
        get('/api/applications').catch(() => ({ applications: [] })),
      ]);
      setStats(statsData);
      setApplications(appsData?.applications || appsData || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, 5);

  const isEmpty = !loading && applications.length === 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page-enter dashboard">
      {/* Welcome */}
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">
            <span className="text-gradient">Welcome back</span> ❄️
          </h1>
          <p className="dashboard__subtitle">
            Here's what's happening with your job applications.
          </p>
        </div>
        <div className="dashboard__actions">
          <button className="btn btn-primary" onClick={() => navigate('/setup')}>
            🚀 New Application
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/emails')}>
            ✉️ Generate Emails
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dashboard__loading">
          <div className="flex gap-lg">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton skeleton-card" style={{ flex: 1, height: 100 }} />
            ))}
          </div>
          <div className="skeleton skeleton-card" style={{ height: 300, marginTop: 24 }} />
        </div>
      ) : isEmpty ? (
        <div className="dashboard__empty glass-card">
          <div className="empty-state">
            <div className="empty-state__icon">🧊</div>
            <div className="empty-state__title">No Applications Yet</div>
            <div className="empty-state__desc">
              Get started by uploading your resume and adding recruiters. Chills will generate personalized cold emails for you.
            </div>
            <button className="btn btn-primary btn-lg mt-lg" onClick={() => navigate('/setup')}>
              🚀 Get Started
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="dashboard__stats">
            <StatsCard
              value={stats?.total || applications.length}
              label="Total Applications"
              icon="📊"
              color="blue"
            />
            <StatsCard
              value={stats?.sent || applications.filter((a) => ['sent', 'viewed', 'interview', 'offer'].includes(a.status)).length}
              label="Emails Sent"
              icon="✉️"
              color="violet"
            />
            <StatsCard
              value={stats?.interviews || applications.filter((a) => a.status === 'interview').length}
              label="Interviews"
              icon="🎯"
              color="magenta"
            />
            <StatsCard
              value={stats?.offers || applications.filter((a) => a.status === 'offer').length}
              label="Offers"
              icon="🎉"
              color="green"
            />
          </div>

          {/* Pipeline Overview */}
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h2>Pipeline Overview</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/applications')}>
                View all →
              </button>
            </div>
            <PipelineView
              applications={applications}
              onCardClick={(app) => navigate('/applications')}
            />
          </div>

          {/* Recent Activity */}
          <div className="dashboard__section">
            <div className="dashboard__section-header">
              <h2>Recent Activity</h2>
            </div>
            <div className="dashboard__activity">
              {recentApps.map((app) => (
                <div key={app.id || app._id} className="dashboard__activity-item glass-card">
                  <div className="dashboard__activity-icon">
                    {app.status === 'offer' ? '🎉' : app.status === 'interview' ? '🎯' : app.status === 'sent' ? '✉️' : '📝'}
                  </div>
                  <div className="dashboard__activity-info">
                    <div className="dashboard__activity-company">
                      {app.company || app.recruiter?.company || 'Unknown'}
                    </div>
                    <div className="dashboard__activity-date">
                      {formatDate(app.updatedAt || app.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={app.status || 'draft'} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
