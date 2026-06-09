const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// User Schema
// ---------------------------------------------------------------------------
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tier: { type: String, enum: ['free', 'premium'], default: 'free' },
  emailsSent: { type: Number, default: 0 },
  razorpayCustomerId: { type: String, default: null },
  razorpaySubscriptionId: { type: String, default: null },
  subscriptionStatus: { type: String, default: null },
  hasSeenGlobalTour: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ---------------------------------------------------------------------------
// Resume Schema
// ---------------------------------------------------------------------------
const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true, trim: true },
  company: { type: String, default: '', trim: true },
  recruiterName: { type: String, default: '', trim: true },
  source: { type: String, enum: ['manual', 'excel', 'sheets'], default: 'manual' },
}, { timestamps: true });

recruiterSchema.index({ userId: 1, email: 1 }, { unique: true });

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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  viewedAt: { type: Date, default: null },
  replies: [replySubSchema],
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema);

// ---------------------------------------------------------------------------
// Settings Schema (singleton document)
// ---------------------------------------------------------------------------
const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  smtpConfigured: { type: Boolean, default: false },
  smtpHost: { type: String, default: '' },
  smtpPort: { type: Number, default: 587 },
  smtpUser: { type: String, default: '' },
  smtpPass: { type: String, default: '' },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  mobileNumber: { type: String, default: '' },
  immediateJoiner: { type: Boolean, default: false },
  linkedinUrl: { type: String, default: '' },
  portfolioUrl: { type: String, default: '' },
  otherLinks: [{
    label: { type: String, default: '' },
    url: { type: String, default: '' },
  }],
  // AI Provider settings
  aiProvider: { type: String, enum: ['openrouter', 'gemini', 'sambanova', 'puter'], default: 'openrouter' },
  geminiApiKey: { type: String, default: '' },
  sambanovaApiKey: { type: String, default: '' },
  puterAuthToken: { type: String, default: '' },
}, { timestamps: true });

/**
 * Get or create the settings document for a user.
 */
settingsSchema.statics.getForUser = async function (userId) {
  let settings = await this.findOne({ userId });
  if (!settings) {
    settings = await this.create({ userId });
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = { User, Resume, Recruiter, Application, Settings };
