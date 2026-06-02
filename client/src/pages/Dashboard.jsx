import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../utils/api';
import StatsCard from '../components/StatsCard';
import PipelineView from '../components/PipelineView';
import StatusBadge from '../components/StatusBadge';

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
    <div className="flex flex-col gap-10">
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-border pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            <span className="bg-neo-yellow px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Welcome back</span> ❄️
          </h1>
          <p className="text-xl font-bold opacity-80 mt-4">
            Here's what's happening with your job applications.
          </p>
        </div>
        <div className="flex gap-4">
          <button className="btn-neo btn-neo-green" onClick={() => navigate('/setup')}>
            🚀 New Application
          </button>
          <button className="btn-neo btn-neo-white" onClick={() => navigate('/emails')}>
            ✉️ Generate Emails
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-8">
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-32 bg-gray-200 border-4 border-border rounded-base" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 border-4 border-border rounded-base" />
        </div>
      ) : isEmpty ? (
        <div className="card-neo flex flex-col items-center justify-center p-12 text-center border-4">
          <div className="text-6xl mb-4">🧊</div>
          <div className="text-2xl font-black uppercase tracking-wider mb-2">No Applications Yet</div>
          <div className="text-lg max-w-md mx-auto opacity-80 font-medium mb-8">
            Get started by uploading your resume and adding recruiters. Chills will generate personalized cold emails for you.
          </div>
          <button className="btn-neo btn-neo-blue text-lg px-8 py-4" onClick={() => navigate('/setup')}>
            🚀 Get Started
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-4 border-border pb-2">
              <h2 className="text-2xl font-black uppercase tracking-widest">Pipeline Overview</h2>
              <button className="font-bold hover:underline" onClick={() => navigate('/applications')}>
                View all →
              </button>
            </div>
            <PipelineView
              applications={applications}
              onCardClick={(app) => navigate('/applications')}
            />
          </div>

          {/* Recent Activity */}
          <div className="flex flex-col gap-4">
            <div className="border-b-4 border-border pb-2">
              <h2 className="text-2xl font-black uppercase tracking-widest">Recent Activity</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentApps.map((app) => (
                <div 
                  key={app.id || app._id} 
                  className="card-neo flex items-center justify-between p-4 cursor-pointer hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neohover transition-all"
                  onClick={() => navigate('/applications')}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl bg-gray-100 p-2 rounded-full border-2 border-border">
                      {app.status === 'offer' ? '🎉' : app.status === 'interview' ? '🎯' : app.status === 'sent' ? '✉️' : '📝'}
                    </div>
                    <div>
                      <div className="font-bold text-lg truncate w-32 md:w-48">
                        {app.company || app.recruiter?.company || 'Unknown'}
                      </div>
                      <div className="text-xs font-bold opacity-70 uppercase tracking-widest mt-1">
                        {formatDate(app.updatedAt || app.createdAt)}
                      </div>
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
