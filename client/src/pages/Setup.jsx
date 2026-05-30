import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, del, upload } from '../utils/api';
import { useToast } from '../components/Toast';
import FileUpload from '../components/FileUpload';
import './Setup.css';

const STEPS = [
  { num: 1, label: 'Resume' },
  { num: 2, label: 'Recruiters' },
  { num: 3, label: 'Review' },
];

export default function Setup() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);

  // Resume state
  const [resume, setResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);

  // Recruiters state
  const [recruiters, setRecruiters] = useState([]);
  const [recruiterTab, setRecruiterTab] = useState('manual');
  const [manualForm, setManualForm] = useState({ email: '', company: '', recruiterName: '' });
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [addingRecruiter, setAddingRecruiter] = useState(false);
  const [selectedRecruiters, setSelectedRecruiters] = useState([]);

  useEffect(() => {
    fetchResume();
    fetchRecruiters();
  }, []);

  const fetchResume = async () => {
    setResumeLoading(true);
    try {
      const data = await get('/api/resume');
      setResume(data?.resume || data || null);
    } catch {
      setResume(null);
    } finally {
      setResumeLoading(false);
    }
  };

  const fetchRecruiters = async () => {
    try {
      const data = await get('/api/recruiters');
      setRecruiters(data?.recruiters || data || []);
    } catch {
      setRecruiters([]);
    }
  };

  const handleResumeUpload = async (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const data = await upload('/api/resume/upload', formData);
      setResume(data?.resume || data);
      toast.success('Resume uploaded successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to upload resume');
      throw err;
    }
  };

  const handleResumeRemove = async () => {
    try {
      await del('/api/resume');
      setResume(null);
      toast.info('Resume removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove resume');
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualForm.email.trim() || !manualForm.company.trim()) {
      toast.warning('Email and company are required');
      return;
    }
    setAddingRecruiter(true);
    try {
      await post('/api/recruiters/manual', manualForm);
      setManualForm({ email: '', company: '', recruiterName: '' });
      fetchRecruiters();
      toast.success('Recruiter added!');
    } catch (err) {
      toast.error(err.message || 'Failed to add recruiter');
    } finally {
      setAddingRecruiter(false);
    }
  };

  const handleExcelUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await upload('/api/recruiters/excel', formData);
      fetchRecruiters();
      toast.success('Recruiters imported from Excel!');
    } catch (err) {
      toast.error(err.message || 'Failed to import Excel');
      throw err;
    }
  };

  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) return;
    try {
      await post('/api/recruiters/sheets', { url: sheetsUrl });
      fetchRecruiters();
      setSheetsUrl('');
      toast.success('Recruiters imported from Google Sheets!');
    } catch (err) {
      toast.error(err.message || 'Failed to import from Sheets');
    }
  };

  const handleDeleteRecruiter = async (id) => {
    try {
      await del(`/api/recruiters/${id}`);
      setRecruiters((prev) => prev.filter((r) => (r.id || r._id) !== id));
      setSelectedRecruiters((prev) => prev.filter(rId => rId !== id));
      toast.info('Recruiter removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove recruiter');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecruiters.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedRecruiters.length} recruiter(s)?`)) return;

    try {
      await post('/api/recruiters/bulk-delete', { ids: selectedRecruiters });
      setRecruiters((prev) => prev.filter((r) => !selectedRecruiters.includes(r.id || r._id)));
      setSelectedRecruiters([]);
      toast.info(`Removed ${selectedRecruiters.length} recruiter(s)`);
    } catch (err) {
      toast.error(err.message || 'Failed to bulk delete recruiters');
    }
  };

  const handleDeleteAll = async () => {
    if (recruiters.length === 0) return;
    if (!window.confirm('Are you sure you want to delete ALL recruiters? This action cannot be undone.')) return;
    
    const allIds = recruiters.map(r => r.id || r._id);
    try {
      await post('/api/recruiters/bulk-delete', { ids: allIds });
      setRecruiters([]);
      setSelectedRecruiters([]);
      toast.info('All recruiters removed');
    } catch (err) {
      toast.error(err.message || 'Failed to clear recruiters');
    }
  };

  const toggleSelection = (id) => {
    setSelectedRecruiters(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecruiters.length === recruiters.length) {
      setSelectedRecruiters([]);
    } else {
      setSelectedRecruiters(recruiters.map(r => r.id || r._id));
    }
  };

  const canProceed = () => {
    if (step === 1) return !!resume;
    if (step === 2) return recruiters.length > 0;
    return true;
  };

  return (
    <div className="page-enter setup">
      <h1 className="setup__title">
        <span className="text-gradient">Setup Wizard</span> 🚀
      </h1>
      <p className="setup__subtitle">Let's get everything ready to generate your personalized emails.</p>

      {/* Step indicator */}
      <div className="setup__steps">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.num}>
            <div
              className={`setup__step ${step >= s.num ? 'setup__step--active' : ''} ${step > s.num ? 'setup__step--done' : ''}`}
              onClick={() => s.num <= step && setStep(s.num)}
            >
              <div className="setup__step-dot">
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="setup__step-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`setup__step-line ${step > s.num ? 'setup__step-line--active' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="setup__content">
        {/* Step 1 — Resume */}
        {step === 1 && (
          <div className="setup__panel" key="step1">
            <h2>📄 Upload Your Resume</h2>
            <p className="text-secondary text-sm mb-lg">
              Upload your PDF resume. We'll extract your profile to personalize each email.
            </p>
            {resumeLoading ? (
              <div className="skeleton skeleton-card" style={{ height: 180 }} />
            ) : (
              <FileUpload
                accept=".pdf"
                onUpload={handleResumeUpload}
                label="Drop your resume PDF here"
                icon="📄"
                currentFile={resume}
                onRemove={handleResumeRemove}
              />
            )}
            {resume && resume.profile && (
              <div className="setup__profile-preview glass-card mt-lg p-lg">
                <h4 className="mb-sm">👤 Extracted Profile</h4>
                <div className="setup__profile-grid">
                  {resume.profile.name && (
                    <div><span className="text-muted text-xs">Name</span><br/><strong>{resume.profile.name}</strong></div>
                  )}
                  {resume.profile.email && (
                    <div><span className="text-muted text-xs">Email</span><br/><strong>{resume.profile.email}</strong></div>
                  )}
                  {resume.profile.skills && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <span className="text-muted text-xs">Skills</span><br/>
                      <div className="setup__skills">
                        {(Array.isArray(resume.profile.skills) ? resume.profile.skills : [resume.profile.skills]).map((s, i) => (
                          <span key={i} className="chip">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Recruiters */}
        {step === 2 && (
          <div className="setup__panel" key="step2">
            <h2>👥 Add Recruiters</h2>
            <p className="text-secondary text-sm mb-lg">
              Add recruiter contacts manually, via Excel, or from Google Sheets.
            </p>

            <div className="tabs mb-lg">
              {['manual', 'excel', 'sheets'].map((tab) => (
                <button
                  key={tab}
                  className={`tab ${recruiterTab === tab ? 'tab--active' : ''}`}
                  onClick={() => setRecruiterTab(tab)}
                >
                  {tab === 'manual' ? '✏️ Manual' : tab === 'excel' ? '📊 Excel' : '📋 Sheets'}
                </button>
              ))}
            </div>

            {recruiterTab === 'manual' && (
              <form className="setup__manual-form" onSubmit={handleManualAdd}>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    className="input"
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                    placeholder="recruiter@company.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Company *</label>
                  <input
                    className="input"
                    value={manualForm.company}
                    onChange={(e) => setManualForm({ ...manualForm, company: e.target.value })}
                    placeholder="Google, Meta, etc."
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Recruiter Name</label>
                  <input
                    className="input"
                    value={manualForm.recruiterName}
                    onChange={(e) => setManualForm({ ...manualForm, recruiterName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={addingRecruiter}>
                  {addingRecruiter ? <><span className="spinner spinner--sm" /> Adding...</> : '➕ Add Recruiter'}
                </button>
              </form>
            )}

            {recruiterTab === 'excel' && (
              <FileUpload
                accept=".xlsx,.xls,.csv"
                onUpload={handleExcelUpload}
                label="Drop your Excel/CSV file here"
                icon="📊"
              />
            )}

            {recruiterTab === 'sheets' && (
              <div className="setup__sheets-form">
                <div className="form-group">
                  <label className="form-label">Google Sheets URL</label>
                  <input
                    className="input"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </div>
                <button className="btn btn-primary" onClick={handleSheetsImport} disabled={!sheetsUrl.trim()}>
                  📥 Import from Sheets
                </button>
              </div>
            )}

            {/* Recruiter list */}
            {recruiters.length > 0 && (
              <div className="setup__recruiter-list mt-xl">
                <div className="setup__recruiter-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>Added Recruiters ({recruiters.length})</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedRecruiters.length > 0 && (
                      <span className="text-sm font-semibold" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}>{selectedRecruiters.length} selected</span>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={toggleSelectAll}>
                      {selectedRecruiters.length === recruiters.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedRecruiters.length > 0 && (
                      <button className="btn btn-ghost btn-sm" onClick={handleBulkDelete} style={{ color: 'var(--danger)' }}>
                        Delete Selected
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={handleDeleteAll} style={{ color: 'var(--danger)' }}>
                      Delete All
                    </button>
                  </div>
                </div>
                <div className="setup__recruiter-items">
                  {recruiters.map((r) => {
                    const rId = r.id || r._id;
                    const isSelected = selectedRecruiters.includes(rId);
                    return (
                      <div key={rId} className={`setup__recruiter-item glass-card ${isSelected ? 'setup__recruiter-item--selected' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem' }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelection(rId)}
                          style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', flexShrink: 0 }}
                        />
                        <div className="setup__recruiter-info" onClick={() => toggleSelection(rId)} style={{ cursor: 'pointer', flex: 1 }}>
                          <span className="font-semibold text-sm" style={{ display: 'block' }}>{r.company}</span>
                          <span className="text-xs text-muted" style={{ display: 'block' }}>{r.recruiterName || r.name || ''}</span>
                          <span className="text-xs text-muted" style={{ display: 'block' }}>{r.email}</span>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => { e.stopPropagation(); handleDeleteRecruiter(rId); }}
                          title="Delete recruiter"
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="setup__panel" key="step3">
            <h2>✅ Review & Go</h2>
            <p className="text-secondary text-sm mb-lg">
              Everything looks good? Let's generate your personalized emails.
            </p>

            <div className="setup__review-cards">
              <div className="glass-card p-lg">
                <h4>📄 Resume</h4>
                <p className="text-sm text-secondary mt-xs">
                  {resume ? (resume.filename || resume.name || 'Uploaded') : 'Not uploaded'}
                </p>
                {resume && <span className="badge badge--offer mt-sm">Ready</span>}
              </div>
              <div className="glass-card p-lg">
                <h4>👥 Recruiters</h4>
                <p className="text-sm text-secondary mt-xs">
                  {recruiters.length} recruiter{recruiters.length !== 1 ? 's' : ''} added
                </p>
                {recruiters.length > 0 && <span className="badge badge--offer mt-sm">Ready</span>}
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg mt-xl"
              onClick={() => navigate('/emails')}
              disabled={!resume || recruiters.length === 0}
            >
              ✨ Proceed to Generate Emails
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="setup__nav">
        <button
          className="btn btn-ghost"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
        >
          ← Back
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setStep((s) => s + 1)}
          disabled={step === 3 || !canProceed()}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
