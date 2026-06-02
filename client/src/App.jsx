import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Joyride, STATUS } from 'react-joyride';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { post } from './utils/api';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import Emails from './pages/Emails';
import Applications from './pages/Applications';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Pricing from './pages/Pricing';
import LandingPage from './pages/LandingPage';
import './index.css';

/**
 * Smart home: landing for visitors, dashboard for logged-in users.
 */
function HomeRoute() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <LandingPage />;
}

/**
 * Top-level layout to keep AppShell persistent for logged-in users.
 */
function RootLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="text-4xl animate-spin">⏳</span></div>;
  
  if (user) {
    return (
      <AppShell />
    );
  }
  
  return <Outlet />;
}

/**
 * Redirect to login if not authenticated.
 */
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="text-4xl animate-spin">⏳</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const globalTourSteps = [
  {
    target: 'body',
    content: (
      <div>
        <h3 className="font-black mb-2 text-xl">Welcome to Chills! ❄️</h3>
        <p>Let's take a quick tour to show you how to automate your cold emails and land more interviews.</p>
      </div>
    ),
    placement: 'center',
    skipBeacon: true,
  },
  {
    target: '.nav-tour-setup',
    content: (
      <div>
        <h3 className="font-black mb-2 text-lg">1. Upload your Resume 🚀</h3>
        <p>Start here! Upload your PDF resume so our AI can learn your skills, experience, and flagship projects.</p>
      </div>
    ),
    skipBeacon: true,
  },
  {
    target: '.nav-tour-emails',
    content: (
      <div>
        <h3 className="font-black mb-2 text-lg">2. Generate Emails ✉️</h3>
        <p>Add recruiter details, and our AI will craft highly personalized cold emails that get replies.</p>
      </div>
    ),
    skipBeacon: true,
  },
  {
    target: '.nav-tour-applications',
    content: (
      <div>
        <h3 className="font-black mb-2 text-lg">3. Track Progress 📋</h3>
        <p>Keep track of all the emails you've sent, replies you've received, and interviews you've landed.</p>
      </div>
    ),
    skipBeacon: true,
  },
  {
    target: '.nav-tour-settings',
    content: (
      <div>
        <h3 className="font-black mb-2 text-lg">4. Configure Settings ⚙️</h3>
        <p>Don't forget to connect your Gmail via App Password and update your profile links so we can send emails on your behalf!</p>
      </div>
    ),
    skipBeacon: true,
  }
];

function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, updateUser } = useAuth();
  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  const autoTourChecked = React.useRef(false);

  // Auto-start tour ONCE for users who haven't seen it.
  // The ref ensures this never fires again even if `user` object reference changes.
  useEffect(() => {
    if (autoTourChecked.current) return;
    if (!user) return;
    
    autoTourChecked.current = true;
    
    if (user.hasSeenGlobalTour === false || user.hasSeenGlobalTour === undefined) {
      setRunTour(true);
      // Eagerly mark as seen so a refresh mid-tour won't restart it
      post('/api/auth/tour-seen')
        .then(() => updateUser({ hasSeenGlobalTour: true }))
        .catch((err) => console.error('Failed to mark tour as seen', err));
    }
  }, [user]);

  // Manual restart via sidebar button
  useEffect(() => {
    const handleStartTour = () => {
      setTourKey(prev => prev + 1);
      setRunTour(true);
    };
    window.addEventListener('start-global-tour', handleStartTour);
    return () => window.removeEventListener('start-global-tour', handleStartTour);
  }, []);

  const handleJoyrideEvent = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Joyride
        key={tourKey}
        steps={globalTourSteps}
        run={runTour}
        continuous={true}
        buttons={['back', 'primary', 'skip']}
        onEvent={handleJoyrideEvent}
        options={{
          showProgress: true,
          hideOverlayClose: true,
          zIndex: 1000,
        }}
        styles={{
          tooltipContainer: { textAlign: 'left' },
          tooltip: {
            border: '4px solid #000',
            borderRadius: '0px',
            boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
            padding: '20px',
            backgroundColor: '#ffffff',
            color: '#000000',
          },
          buttonNext: {
            backgroundColor: '#75FA92',
            border: '2px solid #000',
            borderRadius: '4px',
            color: '#000',
            fontWeight: '900',
            boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
          },
          buttonBack: { color: '#000', fontWeight: 'bold', marginRight: '10px' },
          buttonSkip: { color: '#c31d1d', fontWeight: 'bold' },
        }}
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <main className={`flex-1 transition-all duration-300 min-h-screen max-w-full overflow-x-hidden p-8 md:p-12 ${sidebarCollapsed ? 'ml-[88px]' : 'ml-[260px]'}`}>
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Route structure:
 *  /              → Landing (visitors) / Dashboard (logged in)
 *  /login         → Login
 *  /register      → Register
 *  /setup         → Setup (protected)
 *  /emails        → Emails (protected)
 *  /applications  → Applications (protected)
 *  /settings      → Settings (protected)
 *  /pricing       → Pricing (protected)
 */
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<RootLayout />}>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
  
              {/* Smart home — landing or dashboard */}
              <Route path="/" element={<HomeRoute />} />
  
              {/* Protected app routes */}
              <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
              <Route path="/emails" element={<ProtectedRoute><Emails /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
