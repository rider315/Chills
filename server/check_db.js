const mongoose = require('mongoose');
const config = require('./config');
const { Application } = require('./models');

async function checkDB() {
  try {
    await mongoose.connect(config.mongodbUri);
    const apps = await Application.find({}, 'generatedEmail recruiterEmail company status');
    console.log('Applications:', JSON.stringify(apps, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}
checkDB();
