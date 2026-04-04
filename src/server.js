require('dotenv').config();

const mongoose = require('mongoose');
const { connectDb } = require('./config/db');
const User = require('./models/User');
const { startReminderCrons } = require('./services/reminderScheduler');
const app = require('./app');

const PORT = process.env.PORT || 5001;

(async () => {
  try {
    await connectDb();
  } catch (e) {
    console.error('[fitsphere] MongoDB connection failed', e.message);
  }
  if (mongoose.connection.readyState === 1) {
    try {
      await User.syncIndexes();
    } catch (e) {
      console.warn('[fitsphere] User index sync (fix googleId if needed):', e.message);
    }
    startReminderCrons();
  }
  app.listen(PORT, () => {
    console.log(`FitSphere API listening on http://localhost:${PORT}`);
  });
})();
