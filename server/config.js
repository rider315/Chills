const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  mongodbUri: process.env.MONGODB_URI || '',
  uploadsDir: path.resolve(__dirname, '..', 'uploads'),
};

module.exports = config;
