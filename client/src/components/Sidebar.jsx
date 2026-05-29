import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/',             icon: '📊', label: 'Dashboard' },
  { path: '/setup',        icon: '🚀', label: 'Setup' },
  { path: '/emails',       icon: '✉️', label: 'Emails' },
  { path: '/applications', icon: '📋', label: 'Applications' },
  { path: '/settings',     icon: '⚙️', label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <span className="sidebar__logo-icon">❄️</span>
          {!collapsed && <span className="sidebar__logo-text">Chills</span>}
        </div>
        <button
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▸' : '◂'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar__link-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar__link-label">{item.label}</span>}
            {!collapsed && (
              <span className="sidebar__link-indicator" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="sidebar__footer">
          <div className="sidebar__ai-badge">
            <span className="sidebar__ai-dot" />
            AI Powered
          </div>
        </div>
      )}
    </aside>
  );
}
