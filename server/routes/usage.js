const express = require('express');
const { Settings } = require('../models');
const router = express.Router();

/**
 * GET /api/usage/status
 * Get the current usage limits and stats for the configured SMTP user.
 */
router.get('/status', async (req, res) => {
  try {
    const settings = await Settings.getForUser(req.user._id);
    return res.status(200).json({
      configured: settings.smtpConfigured && !!settings.smtpUser,
      emailId: settings.smtpUser || null,
      emailsSent: req.user.emailsSent || 0,
      isPremium: req.user.tier === 'premium',
      limit: 5 // Hardcoded free tier limit
    });
  } catch (error) {
    console.error('Get usage status error:', error);
    return res.status(500).json({ error: 'Failed to get usage status' });
  }
});

/**
 * POST /api/usage/upgrade
 * Placeholder endpoint to simulate Razorpay upgrade
 */
router.post('/upgrade', async (req, res) => {
  try {
    const settings = await Settings.getForUser(req.user._id);
    if (!settings.smtpConfigured || !settings.smtpUser) {
      return res.status(400).json({ error: 'No SMTP user configured yet.' });
    }

    req.user.tier = 'premium';
    await req.user.save();

    return res.status(200).json({
      message: 'Successfully upgraded to premium!',
      usage: {
        emailId: settings.smtpUser,
        emailsSent: req.user.emailsSent || 0,
        isPremium: req.user.tier === 'premium'
      }
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    return res.status(500).json({ error: 'Failed to process upgrade' });
  }
});

module.exports = router;
