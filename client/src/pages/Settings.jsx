import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { get, put, post } from '../utils/api';
import { Joyride, STATUS } from 'react-joyride';

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
    geminiApiKeyFromEnv: false,
    sambanovaApiKey: '',
    sambanovaApiKeyConfigured: false,
    sambanovaApiKeyFromEnv: false,
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showSambanovaKey, setShowSambanovaKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingSambanova, setTestingSambanova] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  const tourSteps = [
    {
      target: '.tour-email-config',
      content: (
        <div>
          <h3 className="font-black mb-2 text-lg">Email Configuration 📧</h3>
          <p>Here you set up SMTP so Chills can send emails directly from your account.</p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: '.tour-app-password',
      skipBeacon: true,
      content: (
        <div>
          <h3 className="font-black mb-2 text-lg">Google App Password 🔑</h3>
          <p className="mb-2">For Gmail, you <strong>cannot</strong> use your regular password.</p>
          <ol className="list-decimal pl-4 space-y-1 text-sm text-left">
            <li>Go to your Google Account Settings</li>
            <li>Search for "App passwords"</li>
            <li>Create a new app password (e.g., name it "Chills")</li>
            <li>Copy the 16-character password and paste it here!</li>
          </ol>
        </div>
      ),
    },
    {
      target: '.tour-ai-provider',
      skipBeacon: true,
      content: (
        <div>
          <h3 className="font-black mb-2 text-lg">AI Provider 🤖</h3>
          <p>Choose between <strong>OpenRouter</strong> (free), <strong>Gemini</strong> (better quality), or <strong>SambaNova</strong> (fast Llama). You can add your own API keys or use the default ones.</p>
        </div>
      ),
    },
    {
      target: '.tour-profile',
      skipBeacon: true,
      content: (
        <div>
          <h3 className="font-black mb-2 text-lg">Your Profile 👤</h3>
          <p>Add your name, email, and phone number. This info will be used in your email signature.</p>
        </div>
      ),
    },
    {
      target: '.tour-links',
      skipBeacon: true,
      content: (
        <div>
          <h3 className="font-black mb-2 text-lg">Profile Links 🔗</h3>
          <p>Add your LinkedIn, Portfolio, or any other links so recruiters can easily check out your work.</p>
        </div>
      ),
    }
  ];

  const handleJoyrideEvent = (data) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
    }
  };

  const startTour = () => {
    // 1. Stop any running tour and bump the key
    setRunTour(false);
    setTourKey(k => k + 1);
    // 2. Wait for React to unmount the old Joyride, then start fresh
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRunTour(true);
      });
    });
  };

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
        geminiApiKeyFromEnv: data.geminiApiKeyFromEnv || false,
        sambanovaApiKey: data.sambanovaApiKey || '',
        sambanovaApiKeyConfigured: data.sambanovaApiKeyConfigured || false,
        sambanovaApiKeyFromEnv: data.sambanovaApiKeyFromEnv || false,
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

  async function handleTestGemini() {
    setTestingGemini(true);
    try {
      const result = await post('/api/settings/test-gemini', {
        geminiApiKey: settings.geminiApiKey,
      });
      if (result.success) {
        toast.success('Gemini API connection successful! 🎉');
      } else {
        toast.error('Gemini test failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      toast.error('Gemini test failed: ' + err.message);
    } finally {
      setTestingGemini(false);
    }
  }

  async function handleTestSambanova() {
    setTestingSambanova(true);
    try {
      const result = await post('/api/settings/test-sambanova', {
        sambanovaApiKey: settings.sambanovaApiKey,
      });
      if (result.success) {
        toast.success('SambaNova API connection successful! 🎉');
      } else {
        toast.error('SambaNova test failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      toast.error('SambaNova test failed: ' + err.message);
    } finally {
      setTestingSambanova(false);
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
      <Joyride
        key={tourKey}
        steps={tourSteps}
        run={runTour}
        continuous={true}
        buttons={['back', 'primary', 'skip']}
        onEvent={handleJoyrideEvent}
        options={{
          showProgress: true,
          hideOverlayClose: true,
          zIndex: 10000,
        }}
        styles={{
          tooltipContainer: {
            textAlign: 'left'
          },
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
          buttonBack: {
            color: '#000',
            fontWeight: 'bold',
            marginRight: '10px'
          },
          buttonSkip: {
            color: '#c31d1d',
            fontWeight: 'bold',
          },
        }}
      />
      <div className="flex flex-col border-b-4 border-border pb-6">
        <div className="flex justify-between items-start">
          <h1 className="text-4xl md:text-5xl font-black mb-2">
            <span className="bg-neo-red text-bw px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Settings</span> ⚙️
          </h1>
          <button 
            onClick={startTour}
            className="btn-neo btn-neo-yellow text-sm py-2 px-4 whitespace-nowrap hidden md:block"
          >
            🧭 Take a Tour
          </button>
        </div>
        <div className="flex justify-between items-end mt-4 md:mt-2">
          <p className="text-xl font-bold opacity-80 mt-4">Configure your API keys, email settings, profile, and links</p>
          <button 
            onClick={startTour}
            className="btn-neo btn-neo-yellow text-sm py-2 px-4 whitespace-nowrap md:hidden"
          >
            🧭 Take a Tour
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* SMTP Configuration */}
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6 tour-email-config">
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
            <div className="flex flex-col gap-1 tour-app-password">
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
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6 tour-ai-provider">
          <div className="flex items-center gap-4 border-b-4 border-border pb-4">
            <span className="text-4xl">🤖</span>
            <div>
              <h2 className="text-2xl font-black">AI Provider</h2>
              <p className="font-bold opacity-70 text-sm">
                {settings.aiProvider === 'gemini' ? '✨ Gemini is active' : settings.aiProvider === 'sambanova' ? '🚀 SambaNova is active' : '🆓 OpenRouter is active (free)'}
              </p>
            </div>
          </div>
          
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-black uppercase tracking-widest text-xs opacity-70">Active Provider</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, aiProvider: 'openrouter' })}
                  className={`flex-1 py-3 px-4 border-4 border-border font-black text-sm uppercase tracking-wider transition-all ${
                    settings.aiProvider === 'openrouter'
                      ? 'bg-neo-blue text-bw shadow-neosm -translate-y-0.5'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  🆓 OpenRouter
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, aiProvider: 'gemini' })}
                  className={`flex-1 py-3 px-4 border-4 border-border font-black text-sm uppercase tracking-wider transition-all ${
                    settings.aiProvider === 'gemini'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-neosm -translate-y-0.5'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  ✨ Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, aiProvider: 'sambanova' })}
                  className={`flex-1 py-3 px-4 border-4 border-border font-black text-sm uppercase tracking-wider transition-all ${
                    settings.aiProvider === 'sambanova'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-neosm -translate-y-0.5'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  🚀 SambaNova
                </button>
              </div>
            </div>

            {settings.aiProvider === 'gemini' && (
              <div className="flex flex-col gap-3 animate-fadeIn">
                {settings.geminiApiKeyFromEnv && !settings.geminiApiKey && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border-2 border-green-300 rounded-base">
                    <span className="text-lg">✅</span>
                    <p className="font-bold text-sm text-green-800">Server default Gemini key is active. You can optionally add your own below.</p>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="font-black uppercase tracking-widest text-xs opacity-70">
                    Gemini API Key {settings.geminiApiKeyConfigured && <span className="text-green-600 normal-case tracking-normal">(configured ✓)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      className="input-neo w-full pr-12"
                      value={settings.geminiApiKey}
                      onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                      placeholder={settings.geminiApiKeyFromEnv ? 'Using server default key...' : 'Enter your Gemini API key...'}
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
                    Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-neo-blue underline hover:no-underline">Google AI Studio</a>
                  </span>
                </div>
              </div>
            )}

            {settings.aiProvider === 'sambanova' && (
              <div className="flex flex-col gap-3 animate-fadeIn">
                {settings.sambanovaApiKeyFromEnv && !settings.sambanovaApiKey && (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 border-2 border-orange-300 rounded-base">
                    <span className="text-lg">✅</span>
                    <p className="font-bold text-sm text-orange-800">Server default SambaNova key is active. You can optionally add your own below.</p>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="font-black uppercase tracking-widest text-xs opacity-70">
                    SambaNova API Key {settings.sambanovaApiKeyConfigured && <span className="text-green-600 normal-case tracking-normal">(configured ✓)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showSambanovaKey ? 'text' : 'password'}
                      className="input-neo w-full pr-12"
                      value={settings.sambanovaApiKey}
                      onChange={(e) => setSettings({ ...settings, sambanovaApiKey: e.target.value })}
                      placeholder={settings.sambanovaApiKeyFromEnv ? 'Using server default key...' : 'Enter your SambaNova API key...'}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xl opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() => setShowSambanovaKey(!showSambanovaKey)}
                    >
                      {showSambanovaKey ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <span className="text-xs font-bold opacity-60 mt-1">
                    Get your API key from <a href="https://cloud.sambanova.ai/apis" target="_blank" rel="noopener noreferrer" className="text-neo-blue underline hover:no-underline">SambaNova Cloud</a>
                  </span>
                </div>
              </div>
            )}

            {settings.aiProvider === 'openrouter' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border-2 border-blue-200 rounded-base animate-fadeIn">
                <span className="text-lg">💡</span>
                <p className="font-bold text-sm text-blue-800">OpenRouter uses free models — no API key needed from you!</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button type="submit" className="btn-neo btn-neo-green flex-1" disabled={saving}>
                {saving ? 'Saving...' : 'Save AI Settings'}
              </button>
              {settings.aiProvider === 'gemini' && (
                <button
                  type="button"
                  className="btn-neo btn-neo-white"
                  onClick={handleTestGemini}
                  disabled={testingGemini || (!settings.geminiApiKey && !settings.geminiApiKeyFromEnv && !settings.geminiApiKeyConfigured)}
                >
                  {testingGemini ? '⏳ Testing...' : '🧪 Test Gemini'}
                </button>
              )}
              {settings.aiProvider === 'sambanova' && (
                <button
                  type="button"
                  className="btn-neo btn-neo-white"
                  onClick={handleTestSambanova}
                  disabled={testingSambanova || (!settings.sambanovaApiKey && !settings.sambanovaApiKeyFromEnv && !settings.sambanovaApiKeyConfigured)}
                >
                  {testingSambanova ? '⏳ Testing...' : '🧪 Test SambaNova'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* User Profile */}
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6 tour-profile">
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
        <div className="card-neo bg-bw border-4 p-6 flex flex-col gap-6 md:col-span-2 lg:col-span-1 tour-links">
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
