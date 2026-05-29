import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { get, put, post } from '../utils/api';
import './Settings.css';

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    userName: '',
    userEmail: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpConfigured: false,
    immediateJoiner: false,
    linkedinUrl: '',
    portfolioUrl: '',
    otherLinks: [],
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await get('/api/settings');
      setSettings({
        userName: data.userName || '',
        userEmail: data.userEmail || '',
        smtpHost: data.smtpHost || 'smtp.gmail.com',
        smtpPort: data.smtpPort || 587,
        smtpUser: data.smtpUser || '',
        smtpPass: data.smtpPass || '',
        smtpConfigured: data.smtpConfigured || false,
        immediateJoiner: data.immediateJoiner || false,
        linkedinUrl: data.linkedinUrl || '',
        portfolioUrl: data.portfolioUrl || '',
        otherLinks: data.otherLinks || [],
      });
    } catch (err) {
      // Settings might not exist yet — that's OK
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await put('/api/settings', settings);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  }



  async function handleTestSmtp() {
    setTestingSmtp(true);
    try {
      const result = await post('/api/settings/test-smtp', {
        host: settings.smtpHost,
        port: settings.smtpPort,
        user: settings.smtpUser,
        pass: settings.smtpPass,
      });
      if (result.success) {
        toast.success('SMTP connection successful!');
      } else {
        toast.error('SMTP connection failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      toast.error('SMTP test failed: ' + err.message);
    } finally {
      setTestingSmtp(false);
    }
  }

  function handleAddLink() {
    setSettings({
      ...settings,
      otherLinks: [...settings.otherLinks, { label: '', url: '' }],
    });
  }

  function handleRemoveLink(index) {
    const updated = settings.otherLinks.filter((_, i) => i !== index);
    setSettings({ ...settings, otherLinks: updated });
  }

  function handleLinkChange(index, field, value) {
    const updated = [...settings.otherLinks];
    updated[index] = { ...updated[index], [field]: value };
    setSettings({ ...settings, otherLinks: updated });
  }

  async function handleExportData() {
    try {
      const data = await get('/api/settings');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chills-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch (err) {
      toast.error('Export failed');
    }
  }

  if (loading) {
    return (
      <div className="settings-page animate-fade-in">
        <div className="page-header">
          <h1 className="gradient-text">Settings</h1>
        </div>
        <div className="settings-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card skeleton-card">
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--text" />
              <div className="skeleton skeleton--text" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page animate-fade-in">
      <div className="page-header">
        <h1 className="gradient-text">Settings</h1>
        <p className="page-subtitle">Configure your API keys, email settings, profile, and links</p>
      </div>

      <div className="settings-grid">


        {/* SMTP Configuration */}
        <div className="glass-card settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">📧</span>
            <div>
              <h2 className="settings-card__title">Email Configuration</h2>
              <p className="settings-card__desc">Set up SMTP to send emails directly from the platform</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="settings-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">SMTP Host</label>
                <input
                  type="text"
                  className="form-input"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="form-group form-group--small">
                <label className="form-label">Port</label>
                <input
                  type="number"
                  className="form-input"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email / Username</label>
              <input
                type="email"
                className="form-input"
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                placeholder="your_email@gmail.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password / App Password</label>
              <div className="input-with-toggle">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  className="form-input"
                  value={settings.smtpPass}
                  onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                  placeholder="Enter app password..."
                />
                <button
                  type="button"
                  className="input-toggle-btn"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                >
                  {showSmtpPass ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="form-hint">For Gmail, use an App Password (not your regular password)</span>
            </div>
            <div className="settings-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Email Settings'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestSmtp}
                disabled={testingSmtp || !settings.smtpUser}
              >
                {testingSmtp ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>
            </div>
          </form>
        </div>

        {/* User Profile */}
        <div className="glass-card settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">👤</span>
            <div>
              <h2 className="settings-card__title">Your Profile</h2>
              <p className="settings-card__desc">Used as the sender identity in outgoing emails</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="settings-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.userName}
                onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={settings.userEmail}
                onChange={(e) => setSettings({ ...settings, userEmail: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                id="immediateJoiner"
                checked={settings.immediateJoiner}
                onChange={(e) => setSettings({ ...settings, immediateJoiner: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="immediateJoiner" className="form-label" style={{ cursor: 'pointer', margin: 0 }}>
                I am an Immediate Joiner
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Profile Links */}
        <div className="glass-card settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">🔗</span>
            <div>
              <h2 className="settings-card__title">Profile Links</h2>
              <p className="settings-card__desc">These links will be included in your outreach emails as a signature block</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="settings-form">
            <div className="form-group">
              <label className="form-label">LinkedIn URL</label>
              <input
                type="url"
                className="form-input"
                value={settings.linkedinUrl}
                onChange={(e) => setSettings({ ...settings, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/your-profile"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Portfolio URL</label>
              <input
                type="url"
                className="form-input"
                value={settings.portfolioUrl}
                onChange={(e) => setSettings({ ...settings, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Other Links</label>
              {settings.otherLinks.map((link, i) => (
                <div key={i} className="link-row">
                  <input
                    type="text"
                    className="form-input form-input--sm"
                    value={link.label}
                    onChange={(e) => handleLinkChange(i, 'label', e.target.value)}
                    placeholder="Label (e.g. GitHub)"
                  />
                  <input
                    type="url"
                    className="form-input"
                    value={link.url}
                    onChange={(e) => handleLinkChange(i, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn--icon-only"
                    onClick={() => handleRemoveLink(i)}
                    title="Remove link"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn--sm" onClick={handleAddLink}>
                ＋ Add another link
              </button>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Links'}
            </button>
          </form>
        </div>

        {/* Data Management */}
        <div className="glass-card settings-card">
          <div className="settings-card__header">
            <span className="settings-card__icon">🗄️</span>
            <div>
              <h2 className="settings-card__title">Data Management</h2>
              <p className="settings-card__desc">Export or manage your application data</p>
            </div>
          </div>
          <div className="settings-form">
            <div className="data-actions">
              <button className="btn btn-secondary" onClick={handleExportData}>
                📥 Export Data as JSON
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                    toast.warning('Data clearing not yet implemented');
                  }
                }}
              >
                🗑️ Clear All Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
