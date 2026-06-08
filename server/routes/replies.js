const express = require('express');
const { Application, Resume, Settings } = require('../models');
const ai = require('../services/ai');

const router = express.Router();

/**
 * POST /api/replies/:applicationId
 * Accept a recruiter's reply text, analyze it with AI, and store.
 */
router.post('/:applicationId', async (req, res) => {
  try {
    const { replyText } = req.body;

    if (!replyText || replyText.trim().length === 0) {
      return res.status(400).json({ error: 'Reply text is required.' });
    }

    const application = await Application.findOne({ _id: req.params.applicationId, userId: req.user._id });
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    // Get resume profile for context
    const resume = await Resume.findOne({ userId: req.user._id });
    const profile = resume ? resume.parsed || {} : {};

    // Get AI provider config
    const settings = await Settings.getForUser(req.user._id);
    const aiConfig = {
      provider: settings.aiProvider || 'openrouter',
      geminiApiKey: settings.geminiApiKey || '',
      sambanovaApiKey: settings.sambanovaApiKey || '',
    };

    // Analyze the reply with AI
    const analysis = await ai.analyzeReply(application.generatedEmail, replyText, profile, aiConfig);

    // Build the reply record
    const reply = {
      from: application.recruiterEmail,
      body: replyText.trim(),
      receivedAt: new Date(),
      suggestedReply: analysis.suggestedReply || '',
      intent: analysis.intent || 'unclear',
      intentSummary: analysis.intentSummary || '',
    };

    application.replies.push(reply);

    // Auto-update status based on intent
    if (analysis.intent === 'interview_request') {
      application.status = 'interview';
    } else if (analysis.intent === 'rejection') {
      application.status = 'rejected';
    } else if (analysis.intent === 'interested' || analysis.intent === 'info_request') {
      application.status = 'viewed';
    }

    await application.save();

    return res.status(200).json({
      message: 'Reply analyzed and stored.',
      reply,
      analysis: {
        intent: analysis.intent,
        intentSummary: analysis.intentSummary,
        suggestedReply: analysis.suggestedReply,
      },
      application,
    });
  } catch (error) {
    console.error('Analyze reply error:', error);
    return res.status(500).json({ error: `Failed to analyze reply: ${error.message}` });
  }
});

/**
 * GET /api/replies/:applicationId
 * Get the reply history for an application.
 */
router.get('/:applicationId', async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.applicationId, userId: req.user._id });
    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    return res.status(200).json({
      applicationId: application._id,
      company: application.company,
      recruiterEmail: application.recruiterEmail,
      replies: application.replies || [],
      total: (application.replies || []).length,
    });
  } catch (error) {
    console.error('Get replies error:', error);
    return res.status(500).json({ error: `Failed to get replies: ${error.message}` });
  }
});

module.exports = router;
