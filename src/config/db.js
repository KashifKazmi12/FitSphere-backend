const mongoose = require('mongoose');

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[fitsphere] MONGODB_URI not set — auth and onboarding will fail until configured.');
    return;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[fitsphere] MongoDB connected');
}

module.exports = { connectDb };
