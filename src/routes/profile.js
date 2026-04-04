const express = require('express');
const { authRequired, loadUser } = require('../middleware/auth');
const { mergeProfileBody } = require('../utils/mergeProfileBody');
const { sendNotificationPreferenceEnabledEmail } = require('../services/emailService');

const router = express.Router();

function reminderSnapshot(user) {
  const rp = user.reminderPreferences || {};
  return {
    workoutReminders: rp.workoutReminders !== false,
    challengeUpdates: rp.challengeUpdates !== false,
    weeklySummary: rp.weeklySummary !== false,
  };
}

router.get('/', authRequired, loadUser, (req, res) => {
  const u = req.user.toObject();
  delete u.passwordHash;
  res.json({ user: u });
});

router.get('/me', authRequired, loadUser, (req, res) => {
  const u = req.user.toObject();
  delete u.passwordHash;
  res.json({ user: u });
});

async function handleProfileUpdate(req, res) {
  try {
    const prevReminders = reminderSnapshot(req.user);

    mergeProfileBody(req.user, req.body);
    if (req.body.reminderPreferences && typeof req.body.reminderPreferences === 'object') {
      const rp = req.body.reminderPreferences;
      if (typeof rp.workoutReminders === 'boolean') {
        req.user.reminderPreferences = req.user.reminderPreferences || {};
        req.user.reminderPreferences.workoutReminders = rp.workoutReminders;
      }
      if (typeof rp.challengeUpdates === 'boolean') {
        req.user.reminderPreferences = req.user.reminderPreferences || {};
        req.user.reminderPreferences.challengeUpdates = rp.challengeUpdates;
      }
      if (typeof rp.weeklySummary === 'boolean') {
        req.user.reminderPreferences = req.user.reminderPreferences || {};
        req.user.reminderPreferences.weeklySummary = rp.weeklySummary;
      }
    }

    const nextReminders = reminderSnapshot(req.user);
    const firstName = req.user.firstName || req.user.name || '';

    await req.user.save();

    const keys = ['workoutReminders', 'challengeUpdates', 'weeklySummary'];
    keys.forEach((key) => {
      if (nextReminders[key] && !prevReminders[key]) {
        sendNotificationPreferenceEnabledEmail(req.user.email, {
          preferenceKey: key,
          firstName,
        }).catch((err) => {
          console.error('[email] preference enabled notify failed:', err.message);
        });
      }
    });

    const u = req.user.toObject();
    delete u.passwordHash;
    res.json({ user: u });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
}

router.patch('/update', authRequired, loadUser, handleProfileUpdate);

router.post('/update', authRequired, loadUser, handleProfileUpdate);

module.exports = router;
