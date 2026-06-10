const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  sambanovaApiKey: process.env.SAMBANOVA_API_KEY || '',
  puterAuthToken: process.env.PUTER_AUTH_TOKEN || '',
  cerebrasApiKey: process.env.CEREBRAS_API_KEY || '',
  mongodbUri: process.env.MONGODB_URI || '',
  uploadsDir: path.resolve(__dirname, '..', 'uploads'),
  // Used to build absolute tracking pixel URLs. Override in production via APP_URL env var.
  appUrl: process.env.APP_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 3001}`,
};

module.exports = config;
