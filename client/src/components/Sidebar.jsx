import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { path: '/',             icon: '📊', label: 'Dashboard' },
  { path: '/setup',        icon: '🚀', label: 'Setup' },
  { path: '/emails',       icon: '✉️', label: 'Emails' },
  { path: '/applications', icon: '📋', label: 'Applications' },
  { path: '/pricing',      icon: '💎', label: 'Pricing' },
  { path: '/settings',     icon: '⚙️', label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-bw border-r-4 border-border transition-all duration-300 z-50 flex flex-col ${collapsed ? 'w-[88px]' : 'w-[260px]'}`}>
      {/* Logo */}
      <div className={`flex items-center border-b-4 border-border h-[80px] ${collapsed ? 'justify-center p-2' : 'justify-between p-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-2xl flex-shrink-0">❄️</span>
            <span className="text-xl font-black uppercase tracking-widest whitespace-nowrap">Chills</span>
          </div>
        )}
        <button
          className="flex items-center justify-center w-8 h-8 rounded-base border-2 border-border bg-neo-yellow text-text shadow-neosm hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-neohover active:translate-y-0 active:translate-x-0 active:shadow-none transition-all flex-shrink-0"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▸' : '◂'}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto flex flex-col gap-3 ${collapsed ? 'p-2 items-center' : 'p-4'}`}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-tour-${item.label.toLowerCase()} flex items-center gap-3 rounded-base border-2 border-border transition-all whitespace-nowrap overflow-hidden ${collapsed ? 'w-12 h-12 justify-center p-0' : 'p-3'} ${isActive ? 'bg-neo-blue text-bw shadow-neo -translate-y-1 -translate-x-1' : 'bg-bw text-text hover:bg-gray-100 hover:shadow-neosm hover:-translate-y-0.5 hover:-translate-x-0.5'}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="text-xl flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="font-bold">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="p-4 border-t-4 border-border bg-neo-green flex flex-col gap-3">
          {user && (
            <div className="text-xs font-bold uppercase tracking-wider truncate bg-bw p-2 border-2 border-border shadow-neosm rounded-base">
              👤 {user.email}
              {user.tier === 'premium' && <span className="ml-1 text-neo-yellow">★</span>}
            </div>
          )}
          <div className="flex gap-2">
            <button 
              onClick={() => window.dispatchEvent(new Event('start-global-tour'))}
              className="flex-1 btn-neo btn-neo-yellow text-xs py-1.5"
            >
              🧭 Tour
            </button>
            <button 
              onClick={handleLogout}
              className="flex-1 btn-neo btn-neo-white text-xs py-1.5"
            >
              Log Out
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t-4 border-border bg-neo-green flex justify-center items-center">
          <button onClick={handleLogout} title="Log Out" className="w-12 h-12 flex items-center justify-center rounded-base border-2 border-border bg-bw hover:-translate-y-1 hover:shadow-neosm transition-all">
            👋
          </button>
        </div>
      )}
    </aside>
  );
}
