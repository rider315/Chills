const mongoose = require('mongoose');
const config = require('./config');

/**
 * Connect to MongoDB Atlas.
 */
async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('  ✅  Connected to MongoDB Atlas');
  } catch (error) {
    console.error('  ❌  MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
