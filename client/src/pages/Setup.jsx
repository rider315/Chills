import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, del, upload } from '../utils/api';
import { useToast } from '../components/Toast';
import FileUpload from '../components/FileUpload';
import Modal from '../components/Modal';

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
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, count: 0 });

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

  const handleBulkDelete = () => {
    if (selectedRecruiters.length === 0) return;
    setConfirmModal({ isOpen: true, type: 'bulk', count: selectedRecruiters.length });
  };

  const handleDeleteAll = () => {
    if (recruiters.length === 0) return;
    setConfirmModal({ isOpen: true, type: 'all', count: recruiters.length });
  };

  const executeDelete = async () => {
    const { type } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, count: 0 });
    
    if (type === 'bulk') {
      try {
        await post('/api/recruiters/bulk-delete', { ids: selectedRecruiters });
        setRecruiters((prev) => prev.filter((r) => !selectedRecruiters.includes(r.id || r._id)));
        setSelectedRecruiters([]);
        toast.info(`Removed ${selectedRecruiters.length} recruiter(s)`);
      } catch (err) {
        toast.error(err.message || 'Failed to delete selected recruiters');
      }
    } else if (type === 'all') {
      const allIds = recruiters.map(r => r.id || r._id);
      try {
        await post('/api/recruiters/bulk-delete', { ids: allIds });
        setRecruiters([]);
        setSelectedRecruiters([]);
        toast.info('All recruiters removed');
      } catch (err) {
        toast.error(err.message || 'Failed to clear recruiters');
      }
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
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-4xl md:text-5xl font-black mb-2">
          <span className="bg-neo-yellow px-2 inline-block -rotate-1 border-2 border-border shadow-neosm">Setup Wizard</span> 🚀
        </h1>
        <p className="text-xl font-bold opacity-80 mt-4">Let's get everything ready to generate your personalized emails.</p>
      </div>

      {/* Step indicator */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.num}>
            <div
              className={`flex-1 flex items-center gap-3 p-4 border-4 border-border rounded-base cursor-pointer transition-all ${step === s.num ? 'bg-neo-blue text-bw shadow-neo scale-[1.02]' : step > s.num ? 'bg-neo-green text-text shadow-neosm opacity-90' : 'bg-bw text-text hover:bg-gray-100'}`}
              onClick={() => s.num <= step && setStep(s.num)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-border bg-bw text-text font-black">
                {step > s.num ? '✓' : s.num}
              </div>
              <span className="font-bold uppercase tracking-wider">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="hidden md:flex items-center justify-center text-2xl font-black opacity-50">
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-bw border-4 border-border rounded-base p-6 md:p-10 shadow-neo">
        {/* Step 1 — Resume */}
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black mb-2">📄 Upload Your Resume</h2>
              <p className="font-medium opacity-80">
                Upload your PDF resume. We'll extract your profile to personalize each email.
              </p>
            </div>
            
            {resumeLoading ? (
              <div className="h-48 bg-gray-200 animate-pulse border-4 border-border rounded-base" />
            ) : (
              <div className="border-4 border-dashed border-border rounded-base p-8 hover:bg-gray-50 transition-colors">
                <FileUpload
                  accept=".pdf"
                  onUpload={handleResumeUpload}
                  label="Drop your resume PDF here"
                  icon="📄"
                  currentFile={resume}
                  onRemove={handleResumeRemove}
                />
              </div>
            )}
            
            {resume && resume.profile && (
              <div className="card-neo mt-4 bg-neo-yellow text-text">
                <h4 className="text-xl font-black mb-4">👤 Extracted Profile</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-medium">
                  {resume.profile.name && (
                    <div className="bg-bw border-2 border-border rounded-base p-3 shadow-neosm">
                      <span className="text-xs uppercase font-bold opacity-60">Name</span><br/>
                      <strong className="text-lg">{resume.profile.name}</strong>
                    </div>
                  )}
                  {resume.profile.email && (
                    <div className="bg-bw border-2 border-border rounded-base p-3 shadow-neosm">
                      <span className="text-xs uppercase font-bold opacity-60">Email</span><br/>
                      <strong className="text-lg">{resume.profile.email}</strong>
                    </div>
                  )}
                  {resume.profile.skills && (
                    <div className="col-span-1 md:col-span-2 bg-bw border-2 border-border rounded-base p-3 shadow-neosm">
                      <span className="text-xs uppercase font-bold opacity-60 block mb-2">Skills</span>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(resume.profile.skills) ? resume.profile.skills : [resume.profile.skills]).map((s, i) => (
                          <span key={i} className="bg-neo-blue text-bw px-2 py-1 rounded-full border-2 border-border text-sm font-bold shadow-neosm">{s}</span>
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
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black mb-2">👥 Add Recruiters</h2>
              <p className="font-medium opacity-80">
                Add recruiter contacts manually, via Excel, or from Google Sheets.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 border-b-4 border-border pb-4">
              {['manual', 'excel', 'sheets'].map((tab) => (
                <button
                  key={tab}
                  className={`px-6 py-2 border-2 border-border font-bold rounded-full transition-all ${recruiterTab === tab ? 'bg-neo-purple text-bw shadow-neosm translate-y-0.5' : 'bg-bw hover:bg-gray-100 shadow-neo hover:translate-y-[-2px]'}`}
                  onClick={() => setRecruiterTab(tab)}
                >
                  {tab === 'manual' ? '✏️ Manual' : tab === 'excel' ? '📊 Excel' : '📋 Sheets'}
                </button>
              ))}
            </div>

            {recruiterTab === 'manual' && (
              <form className="flex flex-col gap-4 max-w-md" onSubmit={handleManualAdd}>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-sm uppercase tracking-wide">Email *</label>
                  <input
                    className="input-neo"
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                    placeholder="recruiter@company.com"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-sm uppercase tracking-wide">Company *</label>
                  <input
                    className="input-neo"
                    value={manualForm.company}
                    onChange={(e) => setManualForm({ ...manualForm, company: e.target.value })}
                    placeholder="Google, Meta, etc."
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-sm uppercase tracking-wide">Recruiter Name</label>
                  <input
                    className="input-neo"
                    value={manualForm.recruiterName}
                    onChange={(e) => setManualForm({ ...manualForm, recruiterName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <button className="btn-neo btn-neo-green mt-2 self-start" type="submit" disabled={addingRecruiter}>
                  {addingRecruiter ? 'Adding...' : '➕ Add Recruiter'}
                </button>
              </form>
            )}

            {recruiterTab === 'excel' && (
              <div className="border-4 border-dashed border-border rounded-base p-8 hover:bg-gray-50 transition-colors">
                <FileUpload
                  accept=".xlsx,.xls,.csv"
                  onUpload={handleExcelUpload}
                  label="Drop your Excel/CSV file here"
                  icon="📊"
                />
              </div>
            )}

            {recruiterTab === 'sheets' && (
              <div className="flex flex-col gap-4 max-w-md">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-sm uppercase tracking-wide">Google Sheets URL</label>
                  <input
                    className="input-neo"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                </div>
                <button className="btn-neo btn-neo-blue self-start" onClick={handleSheetsImport} disabled={!sheetsUrl.trim()}>
                  📥 Import from Sheets
                </button>
              </div>
            )}

            {/* Recruiter list */}
            {recruiters.length > 0 && (
              <div className="mt-8 border-t-4 border-border pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <h4 className="text-xl font-black m-0">Added Recruiters ({recruiters.length})</h4>
                  <div className="flex flex-wrap items-center gap-4">
                    {selectedRecruiters.length > 0 && (
                      <span className="text-sm font-bold bg-neo-yellow px-2 py-1 rounded-base border-2 border-border">{selectedRecruiters.length} selected</span>
                    )}
                    <button className="btn-neo btn-neo-white text-xs px-4" onClick={toggleSelectAll}>
                      {selectedRecruiters.length === recruiters.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedRecruiters.length > 0 && (
                      <button className="btn-neo bg-neo-red text-bw text-xs px-4" onClick={handleBulkDelete}>
                        Delete Selected
                      </button>
                    )}
                    <button className="font-bold text-neo-red hover:underline text-sm ml-2" onClick={handleDeleteAll}>
                      Delete All
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  {recruiters.map((r) => {
                    const rId = r.id || r._id;
                    const isSelected = selectedRecruiters.includes(rId);
                    return (
                      <div key={rId} className={`card-neo flex items-center gap-4 p-3 transition-colors ${isSelected ? 'bg-blue-50 border-neo-blue' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelection(rId)}
                          className="w-5 h-5 cursor-pointer accent-neo-blue border-2 border-border rounded-sm flex-shrink-0"
                        />
                        <div className="flex-1 cursor-pointer flex flex-col md:flex-row md:items-center justify-between" onClick={() => toggleSelection(rId)}>
                          <div className="flex flex-col">
                            <span className="font-black text-lg">{r.company}</span>
                            <span className="text-sm font-bold opacity-70">{r.recruiterName || r.name || 'No Name'}</span>
                          </div>
                          <span className="font-medium bg-gray-100 px-3 py-1 rounded-full border-2 border-border text-sm mt-2 md:mt-0 shadow-neosm self-start md:self-auto">{r.email}</span>
                        </div>
                        <button
                          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neo-red hover:text-bw border-2 border-transparent hover:border-border transition-all"
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
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-black mb-2">✅ Review & Go</h2>
              <p className="font-medium opacity-80">
                Everything looks good? Let's generate your personalized emails.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card-neo bg-neo-yellow">
                <h4 className="text-2xl font-black mb-2">📄 Resume</h4>
                <p className="font-bold opacity-80">
                  {resume ? (resume.filename || resume.name || 'Uploaded') : 'Not uploaded'}
                </p>
                {resume && <span className="badge-neo bg-neo-green text-text mt-4">Ready</span>}
              </div>
              <div className="card-neo bg-neo-blue text-bw">
                <h4 className="text-2xl font-black mb-2">👥 Recruiters</h4>
                <p className="font-bold opacity-80 text-white">
                  {recruiters.length} recruiter{recruiters.length !== 1 ? 's' : ''} added
                </p>
                {recruiters.length > 0 && <span className="badge-neo bg-neo-green text-text mt-4 shadow-none">Ready</span>}
              </div>
            </div>

            <button
              className="btn-neo btn-neo-green text-xl py-4 mt-8"
              onClick={() => navigate('/emails')}
              disabled={!resume || recruiters.length === 0}
            >
              ✨ Proceed to Generate Emails
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-4">
        <button
          className={`font-bold px-6 py-2 rounded-full border-2 border-border transition-all ${step === 1 ? 'opacity-50 cursor-not-allowed bg-gray-200' : 'bg-bw hover:-translate-x-1 hover:shadow-neosm'}`}
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
        >
          ← Back
        </button>
        <button
          className={`btn-neo text-lg ${step === 3 || !canProceed() ? 'opacity-50 cursor-not-allowed' : 'btn-neo-blue'}`}
          onClick={() => setStep((s) => s + 1)}
          disabled={step === 3 || !canProceed()}
        >
          Next →
        </button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, count: 0 })}
        title="Confirm Deletion"
        footer={
          <>
            <button className="btn-neo btn-neo-white" onClick={() => setConfirmModal({ isOpen: false, type: null, count: 0 })}>Cancel</button>
            <button className="btn-neo bg-neo-red text-bw" onClick={executeDelete}>Delete</button>
          </>
        }
      >
        <p className="text-lg font-medium">
          {confirmModal.type === 'all' 
            ? 'Are you sure you want to delete ALL recruiters? This action cannot be undone.' 
            : `Are you sure you want to delete ${confirmModal.count} selected recruiter(s)?`}
        </p>
      </Modal>
    </div>
  );
}
