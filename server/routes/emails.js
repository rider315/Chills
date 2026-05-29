const express = require('express');
const path = require('path');
const fs = require('fs');
const { Resume, Recruiter, Application, Settings } = require('../models');
const gemini = require('../services/gemini');
const emailSender = require('../services/emailSender');
const config = require('../config');

const router = express.Router();

/**
 * Helper: get profile links and settings
 */
async function getProfileSettings() {
  const settings = await Settings.getSingleton();
  return {
    linkedinUrl: settings.linkedinUrl || '',
    portfolioUrl: settings.portfolioUrl || '',
    otherLinks: (settings.otherLinks || []).filter((l) => l.url),
    immediateJoiner: settings.immediateJoiner || false,
  };
}

/**
 * Helper: find the resume file path on disk
 */
function findResumeFile(resume) {
  if (!resume || !resume.filename) return null;
  // The uploaded file is stored with a unique name like resume-<timestamp>.pdf
  // Search the uploads dir for a file matching the pattern
  const uploadsDir = config.uploadsDir;
  try {
    const files = fs.readdirSync(uploadsDir).filter((f) => f.startsWith('resume-') && f.endsWith('.pdf'));
    if (files.length > 0) {
      // Return the most recent resume file
      files.sort().reverse();
      return {
        filename: resume.filename, // original name for the attachment
        path: path.join(uploadsDir, files[0]),
      };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * GET /api/emails/status
 * Return a map of recruiterId -> { hasEmail, status } for all recruiters.
 * Used by the frontend to show which recruiters already have generated emails.
 */
router.get('/status', async (req, res) => {
  try {
    const applications = await Application.find({}, 'recruiterId status generatedEmail');
    const statusMap = {};
    for (const app of applications) {
      statusMap[app.recruiterId.toString()] = {
        hasEmail: !!(app.generatedEmail && app.generatedEmail.subject),
        status: app.status,
        applicationId: app._id,
      };
    }
    return res.status(200).json({ statusMap });
  } catch (error) {
    console.error('Email status error:', error);
    return res.status(500).json({ error: `Failed to get email status: ${error.message}` });
  }
});

/**
 * POST /api/emails/generate/:recruiterId
 * Full AI pipeline: research company → generate email → suggest send time → create application.
 */
router.post('/generate/:recruiterId', async (req, res) => {
  try {
    const { recruiterId } = req.params;

    // Get resume
    const resume = await Resume.findOne();
    if (!resume || !resume.parsed || Object.keys(resume.parsed).length === 0) {
      return res.status(400).json({ error: 'Please upload and parse a resume first.' });
    }

    // Find recruiter
    const recruiter = await Recruiter.findById(recruiterId);
    if (!recruiter) {
      return res.status(404).json({ error: 'Recruiter not found.' });
    }

    // Check for existing application (skip if regenerating via ?force=true)
    const force = req.query.force === 'true';
    const existingApp = await Application.findOne({ recruiterId });
    if (!force && existingApp && existingApp.generatedEmail && existingApp.generatedEmail.subject) {
      return res.status(200).json({
        message: 'Application already exists for this recruiter.',
        application: existingApp,
        alreadyExists: true,
      });
    }

    // Get profile settings (links, immediateJoiner)
    const profileSettings = await getProfileSettings();

    // Step 1: Research company
    const companyResearch = await gemini.researchCompany(recruiter.company || 'Unknown Company');

    // Step 2: Generate personalized email (with links and settings)
    const generatedEmail = await gemini.generateEmail(resume.parsed, companyResearch, recruiter, profileSettings);

    // Step 3: Suggest optimal send time
    const sendTimeInfo = await gemini.suggestSendTime(recruiter.company, recruiter);

    if (existingApp) {
      // Update existing application
      existingApp.generatedEmail = generatedEmail;
      existingApp.suggestedSendTime = sendTimeInfo.suggestedTime || '';
      existingApp.companyResearch = companyResearch;
      existingApp.recruiterEmail = recruiter.email;
      existingApp.company = recruiter.company;
      existingApp.recruiterName = recruiter.recruiterName;
      existingApp.status = 'draft';
      await existingApp.save();

      return res.status(200).json({
        message: 'Email generated successfully.',
        application: existingApp,
        sendTimeReason: sendTimeInfo.reason || '',
      });
    }

    // Create new application record
    const application = await Application.create({
      recruiterId: recruiter._id,
      recruiterEmail: recruiter.email,
      company: recruiter.company,
      recruiterName: recruiter.recruiterName,
      status: 'draft',
      generatedEmail,
      suggestedSendTime: sendTimeInfo.suggestedTime || '',
      companyResearch,
    });

    return res.status(201).json({
      message: 'Email generated successfully.',
      application,
      sendTimeReason: sendTimeInfo.reason || '',
    });
  } catch (error) {
    console.error('Generate email error:', error);
    return res.status(500).json({ error: `Failed to generate email: ${error.message}` });
  }
});

/**
 * POST /api/emails/generate-bulk
 * Generate emails for all recruiters that don't have applications yet.
 */
router.post('/generate-bulk', async (req, res) => {
  try {
    const resume = await Resume.findOne();
    if (!resume || !resume.parsed || Object.keys(resume.parsed).length === 0) {
      return res.status(400).json({ error: 'Please upload and parse a resume first.' });
    }

    const profileSettings = await getProfileSettings();

    // Find recruiters without applications
    const existingRecruiterIds = (await Application.find({}, 'recruiterId')).map((a) => a.recruiterId.toString());
    const existingSet = new Set(existingRecruiterIds);
    const allRecruiters = await Recruiter.find();
    const pendingRecruiters = allRecruiters.filter((r) => !existingSet.has(r._id.toString()));

    if (pendingRecruiters.length === 0) {
      return res.status(200).json({
        message: 'All recruiters already have generated emails.',
        generated: 0,
        total: allRecruiters.length,
      });
    }

    const results = { generated: 0, failed: 0, errors: [] };

    for (const recruiter of pendingRecruiters) {
      try {
        const companyResearch = await gemini.researchCompany(recruiter.company || 'Unknown Company');
        const generatedEmail = await gemini.generateEmail(resume.parsed, companyResearch, recruiter, profileSettings);
        const sendTimeInfo = await gemini.suggestSendTime(recruiter.company, recruiter);

        await Application.create({
          recruiterId: recruiter._id,
          recruiterEmail: recruiter.email,
          company: recruiter.company,
          recruiterName: recruiter.recruiterName,
          status: 'draft',
          generatedEmail,
          suggestedSendTime: sendTimeInfo.suggestedTime || '',
          companyResearch,
        });

        results.generated++;
      } catch (err) {
        results.failed++;
        results.errors.push({ recruiterId: recruiter._id, email: recruiter.email, error: err.message });
      }
    }

    const total = await Application.countDocuments();

    return res.status(200).json({
      message: `Bulk generation complete. Generated: ${results.generated}, Failed: ${results.failed}.`,
      ...results,
      total,
    });
  } catch (error) {
    console.error('Bulk generate error:', error);
    return res.status(500).json({ error: `Bulk generation failed: ${error.message}` });
  }
});

/**
 * GET /api/emails/by-recruiter/:recruiterId
 * Find an application by recruiter ID (so the frontend can look up by recruiter).
 */
router.get('/by-recruiter/:recruiterId', async (req, res) => {
  try {
    const application = await Application.findOne({ recruiterId: req.params.recruiterId });
    if (!application) {
      return res.status(404).json({ error: 'No application found for this recruiter.' });
    }
    return res.status(200).json({ application });
  } catch (error) {
    console.error('Get email by recruiter error:', error);
    return res.status(500).json({ error: `Failed to get email: ${error.message}` });
  }
});

/**
 * GET /api/emails/:applicationId
 * Get an application with its generated email.
 */
router.get('/:applicationId', async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    return res.status(200).json({ application });
  } catch (error) {
    console.error('Get email error:', error);
    return res.status(500).json({ error: `Failed to get email: ${error.message}` });
  }
});

/**
 * PUT /api/emails/:applicationId
 * Update the email subject and/or body.
 */
router.put('/:applicationId', async (req, res) => {
  try {
    const { subject, body } = req.body;
    const application = await Application.findById(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (subject !== undefined) application.generatedEmail.subject = subject;
    if (body !== undefined) application.generatedEmail.body = body;
    await application.save();

    return res.status(200).json({ message: 'Email updated.', application });
  } catch (error) {
    console.error('Update email error:', error);
    return res.status(500).json({ error: `Failed to update email: ${error.message}` });
  }
});

/**
 * POST /api/emails/:applicationId/send
 * Send the email via SMTP with resume attached.
 */
router.post('/:applicationId/send', async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (!application.generatedEmail || !application.generatedEmail.subject) {
      return res.status(400).json({ error: 'No generated email to send. Generate one first.' });
    }

    // Fetch user settings from DB
    const settings = await Settings.getSingleton();

    // Prioritize DB settings; fallback to .env config if DB is not configured
    const smtpConfig = settings.smtpConfigured ? {
      host: settings.smtpHost,
      port: settings.smtpPort,
      user: settings.smtpUser,
      pass: settings.smtpPass,
    } : config.smtp;

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: 'SMTP is not configured. Please configure SMTP in the Settings page.' });
    }

    const transport = emailSender.createTransport(smtpConfig);
    const fromAddress = `${smtpConfig.user}`;

    // Find resume file for attachment
    const resume = await Resume.findOne();
    const resumeFile = findResumeFile(resume);
    const attachments = resumeFile ? [resumeFile] : [];

    const result = await emailSender.sendEmail(transport, {
      from: settings.userName ? `"${settings.userName}" <${fromAddress}>` : fromAddress,
      to: application.recruiterEmail,
      subject: application.generatedEmail.subject,
      body: application.generatedEmail.body,
      attachments,
    });

    if (!result.success) {
      return res.status(500).json({ error: `Failed to send email: ${result.error}` });
    }

    application.status = 'sent';
    application.sentAt = new Date();
    await application.save();

    return res.status(200).json({
      message: `Email sent successfully${resumeFile ? ' with resume attached' : ''}.`,
      messageId: result.messageId,
      application,
      resumeAttached: !!resumeFile,
    });
  } catch (error) {
    console.error('Send email error:', error);
    return res.status(500).json({ error: `Failed to send email: ${error.message}` });
  }
});

/**
 * POST /api/emails/:applicationId/copy
 * Return the formatted email for clipboard copying.
 */
router.post('/:applicationId/copy', async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (!application.generatedEmail || !application.generatedEmail.subject) {
      return res.status(400).json({ error: 'No generated email to copy.' });
    }

    // Update status to 'applied' when copied (user intends to send manually)
    if (application.status === 'draft') {
      application.status = 'applied';
      await application.save();
    }

    return res.status(200).json({
      to: application.recruiterEmail,
      subject: application.generatedEmail.subject,
      body: application.generatedEmail.body,
      formatted: `To: ${application.recruiterEmail}\nSubject: ${application.generatedEmail.subject}\n\n${application.generatedEmail.body}`,
    });
  } catch (error) {
    console.error('Copy email error:', error);
    return res.status(500).json({ error: `Failed to copy email: ${error.message}` });
  }
});

module.exports = router;
