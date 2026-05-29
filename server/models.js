const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Resume Schema
// ---------------------------------------------------------------------------
const resumeSchema = new mongoose.Schema({
  filename: { type: String, default: '' },
  text: { type: String, default: '' },
  parsed: { type: mongoose.Schema.Types.Mixed, default: {} },
  uploadedAt: { type: Date, default: null },
}, { timestamps: true });

const Resume = mongoose.model('Resume', resumeSchema);

// ---------------------------------------------------------------------------
// Recruiter Schema
// ---------------------------------------------------------------------------
const recruiterSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true },
  company: { type: String, default: '', trim: true },
  recruiterName: { type: String, default: '', trim: true },
  source: { type: String, enum: ['manual', 'excel', 'sheets'], default: 'manual' },
}, { timestamps: true });

recruiterSchema.index({ email: 1 }, { unique: true });

const Recruiter = mongoose.model('Recruiter', recruiterSchema);

// ---------------------------------------------------------------------------
// Application Schema
// ---------------------------------------------------------------------------
const replySubSchema = new mongoose.Schema({
  from: { type: String, default: '' },
  body: { type: String, default: '' },
  receivedAt: { type: Date, default: Date.now },
  suggestedReply: { type: String, default: '' },
  intent: { type: String, default: 'unclear' },
  intentSummary: { type: String, default: '' },
}, { _id: true });

const applicationSchema = new mongoose.Schema({
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruiter', required: true },
  recruiterEmail: { type: String, default: '' },
  company: { type: String, default: '' },
  recruiterName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'applied', 'sent', 'viewed', 'interview', 'rejected', 'offer'],
    default: 'draft',
  },
  generatedEmail: {
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  suggestedSendTime: { type: String, default: '' },
  companyResearch: { type: mongoose.Schema.Types.Mixed, default: {} },
  sentAt: { type: Date, default: null },
  replies: [replySubSchema],
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);

// ---------------------------------------------------------------------------
// Settings Schema (singleton document)
// ---------------------------------------------------------------------------
const settingsSchema = new mongoose.Schema({
  smtpConfigured: { type: Boolean, default: false },
  smtpHost: { type: String, default: '' },
  smtpPort: { type: Number, default: 587 },
  smtpUser: { type: String, default: '' },
  smtpPass: { type: String, default: '' },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  immediateJoiner: { type: Boolean, default: false },
  linkedinUrl: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  otherLinks: [{
    label: { type: String, default: '' },
    url: { type: String, default: '' },
  }],
}, { timestamps: true });

/**
 * Get or create the singleton settings document.
 */
settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = { Resume, Recruiter, Application, Settings };
