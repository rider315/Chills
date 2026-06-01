const mongoose = require('mongoose');
const config = require('./config');
const { Application } = require('./models');

async function fixDB() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to DB');
    
    const result = await Application.deleteMany({
      'generatedEmail.subject': 'Job Application'
    });
    
    console.log(`Deleted ${result.deletedCount} old fallback applications.`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}
fixDB();
