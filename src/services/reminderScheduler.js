const { schedule, validate } = require('node-cron');
const User = require('../models/User');
const Challenge = require('../models/Challenge');
const {
  isSmtpConfigured,
  sendWorkoutReminderEmail,
  sendChallengeDigestEmail,
  sendWeeklyProgressSummaryEmail,
} = require('./emailService');
const { hasCompletedWorkoutOnUtcDay, getWeekStatsForUser } = require('./reminderDigest');

/** Matches profile “default on” semantics: missing pref or not explicitly false. */
function reminderPrefEnabled(field) {
  return {
    $or: [
      { reminderPreferences: { $exists: false } },
      { [`reminderPreferences.${field}`]: { $ne: false } },
    ],
  };
}

async function runWorkoutReminders() {
  if (!isSmtpConfigured()) return;
  const users = await User.find(reminderPrefEnabled('workoutReminders'))
    .select('email firstName name')
    .lean();
  let sent = 0;
  let skippedDone = 0;
  for (const u of users) {
    try {
      if (await hasCompletedWorkoutOnUtcDay(u._id)) {
        skippedDone += 1;
        continue;
      }
      const fn = u.firstName || u.name || '';
      const r = await sendWorkoutReminderEmail(u.email, { firstName: fn });
      if (r.sent) sent += 1;
    } catch (e) {
      console.error('[reminders] workout email failed', u.email, e.message);
    }
  }
  console.log(
    `[reminders] workout reminders: ${sent} sent, ${skippedDone} skipped (already logged today UTC), ${users.length} eligible`
  );
}

async function runChallengeDigest() {
  if (!isSmtpConfigured()) return;
  const now = new Date();
  const challenges = await Challenge.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .sort({ endDate: 1 })
    .limit(10)
    .select('title endDate')
    .lean();
  if (challenges.length === 0) {
    console.log('[reminders] challenge digest: no active challenges, no emails');
    return;
  }
  const users = await User.find(reminderPrefEnabled('challengeUpdates'))
    .select('email firstName name')
    .lean();
  let sent = 0;
  const payload = challenges.map((c) => ({ title: c.title, endDate: c.endDate }));
  for (const u of users) {
    try {
      const fn = u.firstName || u.name || '';
      const r = await sendChallengeDigestEmail(u.email, {
        firstName: fn,
        challenges: payload,
      });
      if (r.sent) sent += 1;
    } catch (e) {
      console.error('[reminders] challenge digest failed', u.email, e.message);
    }
  }
  console.log(`[reminders] challenge digest: ${sent}/${users.length} sent`);
}

async function runWeeklySummary() {
  if (!isSmtpConfigured()) return;
  const users = await User.find(reminderPrefEnabled('weeklySummary'))
    .select('email firstName name weeklyGoal')
    .lean();
  let sent = 0;
  for (const u of users) {
    try {
      const stats = await getWeekStatsForUser(u);
      const fn = u.firstName || u.name || '';
      const r = await sendWeeklyProgressSummaryEmail(u.email, {
        firstName: fn,
        ...stats,
      });
      if (r.sent) sent += 1;
    } catch (e) {
      console.error('[reminders] weekly summary failed', u.email, e.message);
    }
  }
  console.log(`[reminders] weekly summary: ${sent}/${users.length} sent`);
}

function scheduleOrWarn(expr, label, fn) {
  if (!validate(expr)) {
    console.error(`[reminders] Invalid cron expression for ${label}: ${expr}`);
    return;
  }
  const tz = process.env.REMINDER_CRON_TIMEZONE;
  const options = tz ? { timezone: tz } : {};
  schedule(
    expr,
    () => {
      fn().catch((e) => console.error(`[reminders] ${label} job error`, e));
    },
    options
  );
  console.log(`[reminders] Scheduled ${label}: "${expr}"${tz ? ` (${tz})` : ''}`);
}

function startReminderCrons() {
  if (process.env.REMINDER_CRONS_ENABLED === 'false') {
    console.log('[reminders] Scheduled jobs disabled (REMINDER_CRONS_ENABLED=false)');
    return;
  }
  if (!isSmtpConfigured()) {
    console.log(
      '[reminders] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS) — digest schedules still registered but sends are no-ops until email is configured'
    );
  }

  scheduleOrWarn(
    process.env.CRON_WORKOUT_REMINDER || '0 9 * * *',
    'workout reminders (daily)',
    runWorkoutReminders
  );
  scheduleOrWarn(
    process.env.CRON_CHALLENGE_DIGEST || '0 10 * * 1',
    'challenge digest (weekly, Monday)',
    runChallengeDigest
  );
  scheduleOrWarn(
    process.env.CRON_WEEKLY_SUMMARY || '0 18 * * 0',
    'weekly progress summary (weekly, Sunday)',
    runWeeklySummary
  );
}

module.exports = {
  startReminderCrons,
  runWorkoutReminders,
  runChallengeDigest,
  runWeeklySummary,
};
