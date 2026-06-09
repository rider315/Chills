const express = require('express');
const path = require('path');
const fs = require('fs');
const { Resume, Recruiter, Application, Settings } = require('../models');
const ai = require('../services/ai');
const emailSender = require('../services/emailSender');
const config = require('../config');

const router = express.Router();

/**
 * Helper: get profile links and settings
 */
async function getProfileSettings(userId) {
  const settings = await Settings.getForUser(userId);
  return {
    linkedinUrl: settings.linkedinUrl || '',
    portfolioUrl: settings.portfolioUrl || '',
    mobileNumber: settings.mobileNumber || '',
    otherLinks: (settings.otherLinks || []).filter((l) => l.url),
    immediateJoiner: settings.immediateJoiner || false,
  };
}

/**
 * Helper: build AI config from user settings (provider + API key)
 */
async function getAiConfig(userId) {
  const settings = await Settings.getForUser(userId);
  return {
    provider: settings.aiProvider || 'openrouter',
    geminiApiKey: settings.geminiApiKey || config.geminiApiKey || '',
    sambanovaApiKey: settings.sambanovaApiKey || config.sambanovaApiKey || '',
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
    const applications = await Application.find({ userId: req.user._id }, 'recruiterId status generatedEmail');
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
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume || !resume.parsed || Object.keys(resume.parsed).length === 0) {
      return res.status(400).json({ error: 'Please upload and parse a resume first.' });
    }

    // Find recruiter
    const recruiter = await Recruiter.findOne({ _id: recruiterId, userId: req.user._id });
    if (!recruiter) {
      return res.status(404).json({ error: 'Recruiter not found.' });
    }

    // Check for existing application (skip if regenerating via ?force=true)
    const force = req.query.force === 'true';
    const existingApp = await Application.findOne({ recruiterId, userId: req.user._id });
    if (!force && existingApp && existingApp.generatedEmail && existingApp.generatedEmail.subject) {
      return res.status(200).json({
        message: 'Application already exists for this recruiter.',
        application: existingApp,
        alreadyExists: true,
      });
    }

    // Get profile settings (links, immediateJoiner)
    const profileSettings = await getProfileSettings(req.user._id);
    // Get AI provider config
    const aiConfig = await getAiConfig(req.user._id);

    // Step 1: Research company
    const companyResearch = await ai.researchCompany(recruiter.company || 'Unknown Company', aiConfig);
    console.log('Company research done for:', recruiter.company);

    const generatedEmail = await ai.generateEmail(resume.parsed, companyResearch, recruiter, profileSettings, aiConfig);
    console.log('Email generated for:', recruiter.email);

    const sendTimeInfo = await ai.suggestSendTime(recruiter.company, recruiter, aiConfig);

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
      userId: req.user._id,
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
    const resume = await Resume.findOne({ userId: req.user._id });
    if (!resume || !resume.parsed || Object.keys(resume.parsed).length === 0) {
      return res.status(400).json({ error: 'Please upload and parse a resume first.' });
    }

    const profileSettings = await getProfileSettings(req.user._id);
    const aiConfig = await getAiConfig(req.user._id);

    // Allow optional recruiterIds in body
    const { recruiterIds } = req.body || {};
    let targetRecruiters = await Recruiter.find({ userId: req.user._id });
    if (Array.isArray(recruiterIds) && recruiterIds.length > 0) {
      const idSet = new Set(recruiterIds);
      targetRecruiters = targetRecruiters.filter((r) => idSet.has(r._id.toString()));
    }

    // Find recruiters without applications
    const existingRecruiterIds = (await Application.find({ userId: req.user._id }, 'recruiterId')).map((a) => a.recruiterId.toString());
    const existingSet = new Set(existingRecruiterIds);
    const pendingRecruiters = targetRecruiters.filter((r) => !existingSet.has(r._id.toString()));

    if (pendingRecruiters.length === 0) {
      return res.status(200).json({
        message: 'All recruiters already have generated emails.',
        generated: 0,
        total: targetRecruiters.length,
      });
    }

    const results = { generated: 0, failed: 0, errors: [] };

    for (let idx = 0; idx < pendingRecruiters.length; idx++) {
      const recruiter = pendingRecruiters[idx];

      // Add a cooldown delay between recruiters to avoid rate limits (skip before first)
      if (idx > 0) {
        const cooldown = Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000; // 3-6s
        console.log(`[bulk-generate] Cooling down ${cooldown / 1000}s before recruiter ${idx + 1}/${pendingRecruiters.length}...`);
        await new Promise(r => setTimeout(r, cooldown));
      }

      // Try up to 2 attempts per recruiter (1 initial + 1 retry on rate limit)
      let success = false;
      for (let attempt = 0; attempt < 2 && !success; attempt++) {
        try {
          if (attempt > 0) {
            // Extra cooldown before retry after rate limit
            console.log(`[bulk-generate] Rate-limit retry for ${recruiter.company}, waiting 15s...`);
            await new Promise(r => setTimeout(r, 15000));
          }

          const companyResearch = await ai.researchCompany(recruiter.company || 'Unknown Company', aiConfig);
          const generatedEmail = await ai.generateEmail(resume.parsed, companyResearch, recruiter, profileSettings, aiConfig);
          const sendTimeInfo = await ai.suggestSendTime(recruiter.company, recruiter, aiConfig);

          await Application.create({
            userId: req.user._id,
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
          success = true;
        } catch (err) {
          const isRateLimit = err?.status === 429 || err?.statusCode === 429 ||
            (err?.message && err.message.includes('429'));

          if (isRateLimit && attempt === 0) {
            // Will retry after cooldown
            console.warn(`[bulk-generate] Rate limited on ${recruiter.company}, will retry...`);
            continue;
          }

          results.failed++;
          results.errors.push({ recruiterId: recruiter._id, email: recruiter.email, error: err.message });
        }
      }
    }

    const total = await Application.countDocuments({ userId: req.user._id });

    return res.status(200).json({
      message: `Batch generation complete. Generated: ${results.generated}, Failed: ${results.failed}.`,
      ...results,
      total,
    });
  } catch (error) {
    console.error('Bulk generate error:', error);
    return res.status(500).json({ error: `Batch generation failed: ${error.message}` });
  }
});

/**
 * GET /api/emails/by-recruiter/:recruiterId
 * Find an application by recruiter ID (so the frontend can look up by recruiter).
 */
router.get('/by-recruiter/:recruiterId', async (req, res) => {
  try {
    const application = await Application.findOne({ recruiterId: req.params.recruiterId, userId: req.user._id });
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
    const application = await Application.findOne({ _id: req.params.applicationId, userId: req.user._id });
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
    const application = await Application.findOne({ _id: req.params.applicationId, userId: req.user._id });
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
    const application = await Application.findOne({ _id: req.params.applicationId, userId: req.user._id });
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (!application.generatedEmail || !application.generatedEmail.subject) {
      return res.status(400).json({ error: 'No generated email to send. Generate one first.' });
    }

    // Fetch user settings from DB
    const settings = await Settings.getForUser(req.user._id);

    const smtpConfig = {
      host: settings.smtpHost,
      port: settings.smtpPort,
      user: settings.smtpUser,
      pass: settings.smtpPass,
    };

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: 'SMTP is not configured. Please configure SMTP in the Settings page.' });
    }

    const transport = emailSender.createTransport(smtpConfig);
    const fromAddress = `${smtpConfig.user}`;

    // Freemium Limit Check
    if (req.user.tier !== 'premium' && (req.user.emailsSent || 0) >= 5) {
      return res.status(403).json({ error: 'You have reached the limit of 5 emails on the free tier. Please upgrade to premium to send more.' });
    }

    // Find resume file for attachment
    const resume = await Resume.findOne({ userId: req.user._id });
    const resumeFile = findResumeFile(resume);
    const attachments = resumeFile ? [resumeFile] : [];

    const result = await emailSender.sendEmail(transport, {
      from: settings.userName ? `"${settings.userName}" <${fromAddress}>` : fromAddress,
      to: application.recruiterEmail,
      subject: application.generatedEmail.subject,
      body: application.generatedEmail.body,
      attachments,
      trackingPixelUrl: `${config.appUrl}/track/open/${application._id}`,
    });

    if (!result.success) {
      return res.status(500).json({ error: `Failed to send email: ${result.error}` });
    }

    application.status = 'sent';
    application.sentAt = new Date();
    await application.save();

    // Increment usage
    req.user.emailsSent = (req.user.emailsSent || 0) + 1;
    await req.user.save();

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
    const application = await Application.findOne({ _id: req.params.applicationId, userId: req.user._id });
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

/**
 * POST /api/emails/send-bulk
 * Send all generated emails (drafts) in an optimized way.
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const settings = await Settings.getForUser(req.user._id);
    const smtpConfig = {
      host: settings.smtpHost,
      port: settings.smtpPort,
      user: settings.smtpUser,
      pass: settings.smtpPass,
    };

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: 'SMTP is not configured.' });
    }

    const transport = emailSender.createTransport(smtpConfig);
    const fromAddress = `${smtpConfig.user}`;
    
    const { recruiterIds } = req.body || {};
    
    // Find all draft applications with a generated email
    let applications = await Application.find({ status: 'draft', userId: req.user._id });
    if (Array.isArray(recruiterIds) && recruiterIds.length > 0) {
      const idSet = new Set(recruiterIds);
      applications = applications.filter(app => idSet.has(app.recruiterId.toString()));
    }
    const readyToSend = applications.filter(app => app.generatedEmail && app.generatedEmail.subject);

    if (readyToSend.length === 0) {
      return res.status(200).json({ message: 'No draft emails ready to send.', sent: 0, total: 0 });
    }

    const resume = await Resume.findOne({ userId: req.user._id });
    const resumeFile = findResumeFile(resume);
    const attachments = resumeFile ? [resumeFile] : [];

    const results = { sent: 0, failed: 0, errors: [] };
    
    // Check initial limit before loop
    for (const app of readyToSend) {
      if (req.user.tier !== 'premium' && (req.user.emailsSent || 0) >= 5) {
        results.failed++;
        results.errors.push({ recruiterEmail: app.recruiterEmail, error: 'Free tier limit (5 emails) reached.' });
        continue;
      }

      try {
        const result = await emailSender.sendEmail(transport, {
          from: settings.userName ? `"${settings.userName}" <${fromAddress}>` : fromAddress,
          to: app.recruiterEmail,
          subject: app.generatedEmail.subject,
          body: app.generatedEmail.body,
          attachments,
          trackingPixelUrl: `${config.appUrl}/track/open/${app._id}`,
        });

        if (result.success) {
          app.status = 'sent';
          app.sentAt = new Date();
          await app.save();
          
          req.user.emailsSent = (req.user.emailsSent || 0) + 1;
          await req.user.save();
          
          results.sent++;
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ recruiterEmail: app.recruiterEmail, error: err.message });
      }

      // Optimization: random delay between 5 and 10 seconds to mimic human sending
      const delayMs = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return res.status(200).json({
      message: `Batch sending complete. Sent: ${results.sent}, Failed: ${results.failed}.`,
      ...results,
    });
  } catch (error) {
    console.error('Bulk send error:', error);
    return res.status(500).json({ error: `Bulk sending failed: ${error.message}` });
  }
});

module.exports = router;
