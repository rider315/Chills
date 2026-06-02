const express = require('express');
const path = require('path');
const fs = require('fs');
const { Settings } = require('../models');
const emailSender = require('../services/emailSender');

const router = express.Router();

/**
 * GET /api/settings
 * Get current settings (SMTP password is masked).
 */
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getForUser(req.user._id);
    const response = settings.toObject();

    // Mask SMTP password
    if (response.smtpPass) {
      response.smtpPass = '••••••••';
    }

    // Mask Gemini API key
    if (response.geminiApiKey) {
      response.geminiApiKeyConfigured = true;
      response.geminiApiKey = '••••••••';
    } else {
      response.geminiApiKeyConfigured = false;
    }

    // Include whether OpenRouter API key is configured
    const config = require('../config');
    response.openRouterApiKeyConfigured = !!config.openRouterApiKey;

    return res.status(200).json(response);
  } catch (error) {
    console.error('Get settings error:', error);
    return res.status(500).json({ error: `Failed to get settings: ${error.message}` });
  }
});

/**
 * PUT /api/settings
 * Update settings (SMTP, user info).
 */
router.put('/', async (req, res) => {
  try {
    const settings = await Settings.getForUser(req.user._id);
    const updates = req.body;
    const allowedFields = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'userName', 'userEmail', 'mobileNumber', 'linkedinUrl', 'portfolioUrl', 'immediateJoiner', 'aiProvider', 'geminiApiKey'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Prevent overwriting the real password with the masked version
        if (field === 'smtpPass' && updates[field] === '••••••••') {
          continue;
        }
        // Prevent overwriting the real Gemini API key with the masked version
        if (field === 'geminiApiKey' && updates[field] === '••••••••') {
          continue;
        }
        settings[field] = updates[field];
      }
    }

    // Handle otherLinks array separately
    if (updates.otherLinks !== undefined) {
      settings.otherLinks = updates.otherLinks;
    }

    // Auto-set smtpConfigured flag
    settings.smtpConfigured = !!(settings.smtpHost && settings.smtpUser && settings.smtpPass);
    await settings.save();

    // Return settings with masked password
    const response = settings.toObject();
    if (response.smtpPass) {
      response.smtpPass = '••••••••';
    }
    if (response.geminiApiKey) {
      response.geminiApiKeyConfigured = true;
      response.geminiApiKey = '••••••••';
    } else {
      response.geminiApiKeyConfigured = false;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ error: `Failed to update settings: ${error.message}` });
  }
});

/**
 * POST /api/settings/test-smtp
 * Test the SMTP connection.
 */
router.post('/test-smtp', async (req, res) => {
  try {
    const smtpConfig = {
      host: req.body.host,
      port: req.body.port,
      user: req.body.user,
      pass: req.body.pass,
    };

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: 'SMTP settings are incomplete.' });
    }

    const result = await emailSender.testConnection(smtpConfig);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Test SMTP error:', error);
    return res.status(500).json({ error: `SMTP test failed: ${error.message}` });
  }
});



module.exports = router;
