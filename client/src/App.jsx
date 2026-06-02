import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
function SmartHome() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><span className="text-4xl animate-spin">⏳</span></div>;
  if (user) return <AppShell><Dashboard /></AppShell>;
  return <LandingPage />;
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

function AppShell({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      <main className={`flex-1 transition-all duration-300 min-h-screen max-w-full overflow-x-hidden p-8 md:p-12 ${sidebarCollapsed ? 'ml-[88px]' : 'ml-[260px]'}`}>
        {children}
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
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Smart home — landing or dashboard */}
            <Route path="/" element={<SmartHome />} />

            {/* Protected app routes */}
            <Route path="/setup" element={<ProtectedRoute><AppShell><Setup /></AppShell></ProtectedRoute>} />
            <Route path="/emails" element={<ProtectedRoute><AppShell><Emails /></AppShell></ProtectedRoute>} />
            <Route path="/applications" element={<ProtectedRoute><AppShell><Applications /></AppShell></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppShell><Settings /></AppShell></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute><AppShell><Pricing /></AppShell></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
