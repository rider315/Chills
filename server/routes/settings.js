const express = require('express');
const path = require('path');
const fs = require('fs');
const { Settings } = require('../models');
const emailSender = require('../services/emailSender');
const config = require('../config');

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
      // Check if a server-level (env) Gemini key is available
      response.geminiApiKeyConfigured = !!config.geminiApiKey;
      response.geminiApiKeyFromEnv = !!config.geminiApiKey;
    }

    // Mask SambaNova API key
    if (response.sambanovaApiKey) {
      response.sambanovaApiKeyConfigured = true;
      response.sambanovaApiKey = '••••••••';
    } else {
      // Check if a server-level (env) SambaNova key is available
      response.sambanovaApiKeyConfigured = !!config.sambanovaApiKey;
      response.sambanovaApiKeyFromEnv = !!config.sambanovaApiKey;
    }

    // Mask Puter Auth Token
    if (response.puterAuthToken) {
      response.puterAuthTokenConfigured = true;
      response.puterAuthToken = '••••••••';
    } else {
      response.puterAuthTokenConfigured = !!config.puterAuthToken;
      response.puterAuthTokenFromEnv = !!config.puterAuthToken;
    }

    // Mask Cerebras API key
    if (response.cerebrasApiKey) {
      response.cerebrasApiKeyConfigured = true;
      response.cerebrasApiKey = '••••••••';
    } else {
      response.cerebrasApiKeyConfigured = !!config.cerebrasApiKey;
      response.cerebrasApiKeyFromEnv = !!config.cerebrasApiKey;
    }

    // Include whether OpenRouter API key is configured
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
    const allowedFields = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'userName', 'userEmail', 'mobileNumber', 'linkedinUrl', 'portfolioUrl', 'immediateJoiner', 'aiProvider', 'geminiApiKey', 'sambanovaApiKey', 'puterAuthToken', 'cerebrasApiKey'];

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
        // Prevent overwriting the real SambaNova API key with the masked version
        if (field === 'sambanovaApiKey' && updates[field] === '••••••••') {
          continue;
        }
        // Prevent overwriting the real Puter Auth Token with the masked version
        if (field === 'puterAuthToken' && updates[field] === '••••••••') {
          continue;
        }
        // Prevent overwriting the real Cerebras API key with the masked version
        if (field === 'cerebrasApiKey' && updates[field] === '••••••••') {
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
      response.geminiApiKeyConfigured = !!config.geminiApiKey;
      response.geminiApiKeyFromEnv = !!config.geminiApiKey;
    }
    if (response.sambanovaApiKey) {
      response.sambanovaApiKeyConfigured = true;
      response.sambanovaApiKey = '••••••••';
    } else {
      response.sambanovaApiKeyConfigured = !!config.sambanovaApiKey;
      response.sambanovaApiKeyFromEnv = !!config.sambanovaApiKey;
    }
    if (response.puterAuthToken) {
      response.puterAuthTokenConfigured = true;
      response.puterAuthToken = '••••••••';
    } else {
      response.puterAuthTokenConfigured = !!config.puterAuthToken;
      response.puterAuthTokenFromEnv = !!config.puterAuthToken;
    }
    if (response.cerebrasApiKey) {
      response.cerebrasApiKeyConfigured = true;
      response.cerebrasApiKey = '••••••••';
    } else {
      response.cerebrasApiKeyConfigured = !!config.cerebrasApiKey;
      response.cerebrasApiKeyFromEnv = !!config.cerebrasApiKey;
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


/**
 * POST /api/settings/test-gemini
 * Test the Gemini API connection with a minimal prompt.
 */
router.post('/test-gemini', async (req, res) => {
  try {
    const apiKey = req.body.geminiApiKey || config.geminiApiKey;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'No Gemini API key provided or configured.' });
    }

    const OpenAI = require('openai');
    const gemini = new OpenAI({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: apiKey,
    });

    const response = await gemini.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
      max_tokens: 10,
    });

    const content = response.choices?.[0]?.message?.content;
    if (content) {
      return res.status(200).json({ success: true, message: `Gemini responded: "${content.trim()}"` });
    } else {
      return res.status(400).json({ success: false, error: 'Gemini returned an empty response.' });
    }
  } catch (error) {
    console.error('Test Gemini error:', error);
    return res.status(500).json({ success: false, error: `Gemini test failed: ${error.message}` });
  }
});


/**
 * POST /api/settings/test-sambanova
 * Test the SambaNova API connection with a minimal prompt.
 */
router.post('/test-sambanova', async (req, res) => {
  try {
    const apiKey = req.body.sambanovaApiKey || config.sambanovaApiKey;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'No SambaNova API key provided or configured.' });
    }

    const OpenAI = require('openai');
    const sambanova = new OpenAI({
      baseURL: 'https://api.sambanova.ai/v1',
      apiKey: apiKey,
    });

    const response = await sambanova.chat.completions.create({
      model: 'Meta-Llama-3.3-70B-Instruct',
      messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
      max_tokens: 10,
    });

    const content = response.choices?.[0]?.message?.content;
    if (content) {
      return res.status(200).json({ success: true, message: `SambaNova responded: "${content.trim()}"` });
    } else {
      return res.status(400).json({ success: false, error: 'SambaNova returned an empty response.' });
    }
  } catch (error) {
    console.error('Test SambaNova error:', error);
    return res.status(500).json({ success: false, error: `SambaNova test failed: ${error.message}` });
  }
});

/**
 * POST /api/settings/test-puter
 * Test the Puter API connection.
 */
router.post('/test-puter', async (req, res) => {
  try {
    const token = req.body.puterAuthToken || config.puterAuthToken;
    if (!token) {
      return res.status(400).json({ success: false, error: 'No Puter Auth Token provided or configured.' });
    }

    const { puter } = await import('@heyputer/puter.js');
    puter.setAuthToken(token);

    const response = await puter.ai.chat('Say "hello" in one word.', { model: 'claude-sonnet-4-6' });
    const content = response?.message?.content?.[0]?.text;

    if (content) {
      return res.status(200).json({ success: true, message: `Puter responded: "${content.trim()}"` });
    } else {
      return res.status(400).json({ success: false, error: 'Puter returned an empty response.' });
    }
  } catch (error) {
    console.error('Test Puter error:', error);
    return res.status(500).json({ success: false, error: `Puter test failed: ${error.message}` });
  }
});

/**
 * POST /api/settings/test-cerebras
 * Test the Cerebras API connection with a minimal prompt.
 */
router.post('/test-cerebras', async (req, res) => {
  try {
    let apiKey = req.body.cerebrasApiKey;
    let keySource = 'request body';
    // If the key is masked or empty, load the real key from the database or env
    if (!apiKey || apiKey === '••••••••') {
      const settings = await Settings.getForUser(req.user._id);
      if (settings.cerebrasApiKey) {
        apiKey = settings.cerebrasApiKey;
        keySource = 'database';
      } else if (config.cerebrasApiKey) {
        apiKey = config.cerebrasApiKey;
        keySource = 'env';
      }
    }
    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'No Cerebras API key provided or configured.' });
    }

    console.log(`[test-cerebras] Using key from ${keySource}, key starts with: ${apiKey.substring(0, 8)}...`);

    // Fetch available models to find a valid one
    const testResponse = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!testResponse.ok) {
      const errorBody = await testResponse.text().catch(() => 'no body');
      console.error(`[test-cerebras] Models endpoint returned ${testResponse.status}: ${errorBody}`);
      return res.status(400).json({
        success: false,
        error: `Cerebras API returned ${testResponse.status}. Please verify your API key is correct. Get one from https://cloud.cerebras.ai/`,
      });
    }

    const modelsData = await testResponse.json();
    const availableModels = (modelsData.data || []).map(m => m.id);
    console.log(`[test-cerebras] Available models: ${availableModels.join(', ')}`);

    if (availableModels.length === 0) {
      return res.status(400).json({ success: false, error: 'No models available on your Cerebras account.' });
    }

    // Pick the best model: prefer llama-3.3-70b or any llama model, fallback to first available
    const preferredModel = availableModels.find(m => m.includes('llama') && m.includes('70b'))
      || availableModels.find(m => m.includes('llama'))
      || availableModels[0];

    console.log(`[test-cerebras] Using model: ${preferredModel}`);

    // Key is valid, now test a completion
    const OpenAI = require('openai');
    const cerebras = new OpenAI({
      baseURL: 'https://api.cerebras.ai/v1',
      apiKey: apiKey,
    });

    const response = await cerebras.chat.completions.create({
      model: preferredModel,
      messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
      max_completion_tokens: 256,
    });

    console.log(`[test-cerebras] Raw response:`, JSON.stringify(response.choices?.[0]));
    // Cerebras reasoning models (gpt-oss-120b, zai-glm-4.7) put output in message.reasoning instead of message.content
    const msg = response.choices?.[0]?.message;
    const content = msg?.content || msg?.reasoning;
    if (content) {
      return res.status(200).json({ success: true, message: `Cerebras responded: "${content.trim().substring(0, 100)}" (model: ${preferredModel})` });
    } else {
      return res.status(400).json({ success: false, error: 'Cerebras returned an empty response.' });
    }
  } catch (error) {
    console.error('Test Cerebras error:', error);
    return res.status(500).json({ success: false, error: `Cerebras test failed: ${error.message}` });
  }
});

module.exports = router;
