import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { get, put, post } from '../utils/api';

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    userName: '',
    userEmail: '',
    mobileNumber: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpConfigured: false,
    immediateJoiner: false,
    linkedinUrl: '',
    portfolioUrl: '',
    otherLinks: [],
    aiProvider: 'openrouter',
    geminiApiKey: '',
    geminiApiKeyConfigured: false,
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
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
        mobileNumber: data.mobileNumber || '',
        smtpHost: data.smtpHost || 'smtp.gmail.com',
        smtpPort: data.smtpPort || 587,
        smtpUser: data.smtpUser || '',
        smtpPass: data.smtpPass || '',
        smtpConfigured: data.smtpConfigured || false,
        immediateJoiner: data.immediateJoiner || false,
        linkedinUrl: data.linkedinUrl || '',
        portfolioUrl: data.portfolioUrl || '',
        otherLinks: data.otherLinks || [],
        aiProvider: data.aiProvider || 'openrouter',
        geminiApiKey: data.geminiApiKey || '',
        geminiApiKeyConfigured: data.geminiApiKeyConfigured || false,
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


  if (loading) {
    return (
      <div className="flex flex-col gap-8 animate-fadeIn h-full max-w-5xl mx-auto">
        <div className="flex flex-col border-b-4 border-border pb-6">
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            <span className="bg-neo-red text-bw px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Settings</span> ⚙️
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-neo bg-bw border-4 p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 border-2 border-border mb-4" />
              <div className="h-4 bg-gray-200 rounded w-full border-2 border-border mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4 border-2 border-border" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-fadeIn h-full max-w-5xl mx-auto">
      <div className="flex flex-col border-b-4 border-border pb-6">
        <h1 className="text-4xl md:text-5xl font-black mb-2">
          <span className="bg-neo-red text-bw px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Settings</span> ⚙️
        </h1>
        <p className="text-xl font-bold opacity-80 mt-4">Configure your API keys, email settings, profile, and links</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* SMTP Configuration */}
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6">
          <div className="flex items-center gap-4 border-b-4 border-border pb-4">
            <span className="text-4xl">📧</span>
            <div>
              <h2 className="text-2xl font-black">Email Configuration</h2>
              <p className="font-bold opacity-70 text-sm">Set up SMTP to send emails directly from the platform</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-black uppercase tracking-widest text-xs opacity-70">SMTP Host</label>
                <input
                  type="text"
                  className="input-neo"
                  value={settings.smtpHost}
                  onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="flex flex-col gap-1 w-full sm:w-24">
                <label className="font-black uppercase tracking-widest text-xs opacity-70">Port</label>
                <input
                  type="number"
                  className="input-neo"
                  value={settings.smtpPort}
                  onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Email / Username</label>
              <input
                type="email"
                className="input-neo"
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                placeholder="your_email@gmail.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Password / App Password</label>
              <div className="relative">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  className="input-neo w-full pr-12"
                  value={settings.smtpPass}
                  onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                  placeholder="Enter app password..."
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xl opacity-70 hover:opacity-100 transition-opacity"
                  onClick={() => setShowSmtpPass(!showSmtpPass)}
                >
                  {showSmtpPass ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="text-xs font-bold opacity-60 mt-1">For Gmail, use an App Password (not your regular password)</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button type="submit" className="btn-neo btn-neo-green flex-1" disabled={saving}>
                {saving ? 'Saving...' : 'Save Email Settings'}
              </button>
              <button
                type="button"
                className="btn-neo btn-neo-white"
                onClick={handleTestSmtp}
                disabled={testingSmtp || !settings.smtpUser}
              >
                {testingSmtp ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>
            </div>
          </form>
        </div>

        {/* AI Provider Configuration */}
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6">
          <div className="flex items-center gap-4 border-b-4 border-border pb-4">
            <span className="text-4xl">🤖</span>
            <div>
              <h2 className="text-2xl font-black">AI Provider</h2>
              <p className="font-bold opacity-70 text-sm">Choose which AI model generates your emails</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">

            {/* Provider Toggle */}
            <div className="flex flex-col gap-2">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Active Provider</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={`flex-1 py-3 px-4 border-4 border-border font-black text-sm uppercase tracking-wider transition-all ${
                    settings.aiProvider === 'openrouter'
                      ? 'bg-neo-blue text-bw shadow-neosm -translate-y-0.5'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  onClick={() => setSettings({ ...settings, aiProvider: 'openrouter' })}
                >
                  🆓 OpenRouter
                  <span className="block text-xs font-bold mt-1 normal-case tracking-normal opacity-80">
                    Free tier
                  </span>
                </button>
                <button
                  type="button"
                  className={`flex-1 py-3 px-4 border-4 border-border font-black text-sm uppercase tracking-wider transition-all ${
                    settings.aiProvider === 'gemini'
                      ? 'bg-neo-green text-bw shadow-neosm -translate-y-0.5'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  onClick={() => setSettings({ ...settings, aiProvider: 'gemini' })}
                >
                  ✨ Gemini
                  <span className="block text-xs font-bold mt-1 normal-case tracking-normal opacity-80">
                    Paid • Better quality
                  </span>
                </button>
              </div>
            </div>

            {/* Gemini API Key */}
            <div className={`flex flex-col gap-1 transition-all ${settings.aiProvider !== 'gemini' ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Gemini API Key</label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  className="input-neo w-full pr-12"
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  placeholder="Enter your Gemini API key..."
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xl opacity-70 hover:opacity-100 transition-opacity"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? '🙈' : '👁️'}
                </button>
              </div>
              <span className="text-xs font-bold opacity-60 mt-1">
                Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-neo-blue underline">Google AI Studio</a>
              </span>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 border-2 border-border rounded-base">
              <span className={`w-3 h-3 rounded-full ${settings.aiProvider === 'gemini' && settings.geminiApiKeyConfigured ? 'bg-green-500' : settings.aiProvider === 'openrouter' ? 'bg-neo-blue' : 'bg-yellow-500'}`}></span>
              <span className="font-bold text-sm">
                {settings.aiProvider === 'gemini'
                  ? (settings.geminiApiKeyConfigured
                    ? 'Gemini is active — using paid model for better quality emails'
                    : 'Gemini selected — enter and save your API key to activate')
                  : 'OpenRouter is active — using free AI models'
                }
              </span>
            </div>

            <button type="submit" className="btn-neo btn-neo-green mt-2" disabled={saving}>
              {saving ? 'Saving...' : 'Save AI Settings'}
            </button>
          </form>
        </div>

        {/* User Profile */}
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6">
          <div className="flex items-center gap-4 border-b-4 border-border pb-4">
            <span className="text-4xl">👤</span>
            <div>
              <h2 className="text-2xl font-black">Your Profile</h2>
              <p className="font-bold opacity-70 text-sm">Used as the sender identity in outgoing emails</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Full Name</label>
              <input
                type="text"
                className="input-neo"
                value={settings.userName}
                onChange={(e) => setSettings({ ...settings, userName: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Email Address</label>
              <input
                type="email"
                className="input-neo"
                value={settings.userEmail}
                onChange={(e) => setSettings({ ...settings, userEmail: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Mobile Number</label>
              <input
                type="tel"
                className="input-neo"
                value={settings.mobileNumber}
                onChange={(e) => setSettings({ ...settings, mobileNumber: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="flex items-center gap-3 mt-2 p-3 bg-gray-50 border-2 border-border rounded-base cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                id="immediateJoiner"
                checked={settings.immediateJoiner}
                onChange={(e) => setSettings({ ...settings, immediateJoiner: e.target.checked })}
                className="w-5 h-5 cursor-pointer accent-neo-blue border-2 border-border rounded-sm"
              />
              <label htmlFor="immediateJoiner" className="font-black cursor-pointer uppercase tracking-widest text-sm flex-1">
                I am an Immediate Joiner
              </label>
            </div>
            <button type="submit" className="btn-neo btn-neo-blue mt-2" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Profile Links */}
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6 md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-4 border-b-4 border-border pb-4">
            <span className="text-4xl">🔗</span>
            <div>
              <h2 className="text-2xl font-black">Profile Links</h2>
              <p className="font-bold opacity-70 text-sm">These links will be included in your outreach emails as a signature block</p>
            </div>
          </div>
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">LinkedIn URL</label>
              <input
                type="url"
                className="input-neo"
                value={settings.linkedinUrl}
                onChange={(e) => setSettings({ ...settings, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/your-profile"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Portfolio URL</label>
              <input
                type="url"
                className="input-neo"
                value={settings.portfolioUrl}
                onChange={(e) => setSettings({ ...settings, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.com"
              />
            </div>

            <div className="flex flex-col gap-3 mt-2 pt-4 border-t-4 border-border">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Other Links</label>
              {settings.otherLinks.map((link, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <input
                    type="text"
                    className="input-neo w-full sm:w-1/3"
                    value={link.label}
                    onChange={(e) => handleLinkChange(i, 'label', e.target.value)}
                    placeholder="Label (e.g. GitHub)"
                  />
                  <input
                    type="url"
                    className="input-neo flex-1"
                    value={link.url}
                    onChange={(e) => handleLinkChange(i, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full hover:bg-neo-red hover:text-bw border-2 border-transparent hover:border-border transition-all font-bold"
                    onClick={() => handleRemoveLink(i)}
                    title="Remove link"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="font-bold uppercase tracking-widest text-sm text-left hover:underline text-neo-blue w-max mt-2" onClick={handleAddLink}>
                ＋ Add another link
              </button>
            </div>

            <button type="submit" className="btn-neo btn-neo-yellow mt-4" disabled={saving}>
              {saving ? 'Saving...' : 'Save Links'}
            </button>
          </form>
        </div>


      </div>
    </div>
  );
}
