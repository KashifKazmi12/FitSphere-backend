const nodemailer = require('nodemailer');

/**
 * Optional transactional email (notification preferences). If SMTP_* is unset, nothing is sent.
 * Same pattern as MatchFund / Founder–Investor backend (nodemailer + SMTP_* env).
 */
function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  if (!isSmtpConfigured()) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    port === 465 || (process.env.SMTP_SECURE === 'true' && port !== 587);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const PREFERENCE_COPY = {
  workoutReminders: {
    title: 'Workout reminders',
    lead: 'You turned on workout reminders. We’ll use this to help you stay consistent with your training.',
  },
  challengeUpdates: {
    title: 'Challenge & community updates',
    lead: 'You turned on challenge and community updates. You’ll hear about challenges and activity that matters to you.',
  },
  weeklySummary: {
    title: 'Weekly progress summary',
    lead: 'You turned on your weekly progress summary. Look for a concise recap of how your week went.',
  },
};

function fitSphereHtml({ firstName, preferenceKey, dashboardUrl }) {
  const copy = PREFERENCE_COPY[preferenceKey] || {
    title: 'Notification preference',
    lead: 'Your notification settings were updated.',
  };
  const name = firstName ? String(firstName).trim() : '';
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const accent = process.env.EMAIL_BRAND_ACCENT || '#0066ee';
  const fromName = process.env.EMAIL_FROM_NAME || 'FitSphere';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(8,42,107,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${accent} 0%,#4d94ff 100%);padding:28px 32px;">
              <p style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">FitSphere</p>
              <p style="margin:8px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:rgba(255,255,255,0.92);">Nutrition &amp; fitness, built for real life</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
              <p style="margin:0 0 16px;">${greeting}</p>
              <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${copy.title} — enabled</p>
              <p style="margin:0 0 24px;color:#4b5563;">${copy.lead} Please stay in touch with your goals—we’re glad you’re here.</p>
              <p style="margin:0 0 20px;">
                <a href="${dashboardUrl}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Open your dashboard</a>
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">If you didn’t change this setting, sign in and review Notifications under your account.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #ebebf0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} ${fromName}. You’re receiving this because notification email is enabled on your account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a confirmation email when the user enables a notification preference.
 * @param {string} to - user email
 * @param {object} opts
 * @param {string} opts.preferenceKey - workoutReminders | challengeUpdates | weeklySummary
 * @param {string} [opts.firstName]
 * @returns {Promise<{ sent: boolean }>}
 */
async function sendNotificationPreferenceEnabledEmail(to, opts) {
  const transport = createTransport();
  if (!transport) {
    return { sent: false };
  }

  const { preferenceKey, firstName } = opts;
  const copy = PREFERENCE_COPY[preferenceKey];
  if (!copy) {
    return { sent: false };
  }

  const base = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const dashboardUrl = `${base}/dashboard`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'FitSphere';

  const html = fitSphereHtml({ firstName, preferenceKey, dashboardUrl });
  const subject = `${copy.title} — enabled on FitSphere`;

  const text = `FitSphere\n\n${copy.title} is now enabled.\n\n${copy.lead}\n\nOpen your dashboard: ${dashboardUrl}\n`;

  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseDigestHtml({ greeting, headline, innerHtml, dashboardUrl }) {
  const accent = process.env.EMAIL_BRAND_ACCENT || '#0066ee';
  const fromName = process.env.EMAIL_FROM_NAME || 'FitSphere';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(8,42,107,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${accent} 0%,#4d94ff 100%);padding:28px 32px;">
              <p style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">FitSphere</p>
              <p style="margin:8px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:rgba(255,255,255,0.92);">Nutrition &amp; fitness, built for real life</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;">
              <p style="margin:0 0 16px;">${greeting}</p>
              <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${headline}</p>
              ${innerHtml}
              <p style="margin:24px 0 20px;">
                <a href="${dashboardUrl}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Open your dashboard</a>
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">You’re receiving this because this reminder type is enabled in Notifications &amp; reminders.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #ebebf0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} ${fromName}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Scheduled workout nudge (users who haven’t completed a workout today, UTC day).
 */
async function sendWorkoutReminderEmail(to, opts) {
  const transport = createTransport();
  if (!transport) return { sent: false };
  const { firstName } = opts;
  const name = firstName ? String(firstName).trim() : '';
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const base = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const dashboardUrl = `${base}/dashboard`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'FitSphere';
  const headline = 'Time to move';
  const innerHtml = `<p style="margin:0 0 16px;color:#4b5563;">Quick check-in: a short session today keeps your momentum going. Open FitSphere when you’re ready.</p>`;
  const html = baseDigestHtml({ greeting, headline, innerHtml, dashboardUrl });
  const subject = 'Your FitSphere workout reminder';
  const text = `FitSphere\n\n${headline}\n\nA short session today keeps your momentum going.\n\n${dashboardUrl}\n`;
  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

/**
 * Active challenges snapshot (weekly job).
 */
async function sendChallengeDigestEmail(to, opts) {
  const transport = createTransport();
  if (!transport) return { sent: false };
  const { firstName, challenges } = opts;
  if (!challenges || challenges.length === 0) return { sent: false };
  const name = firstName ? String(firstName).trim() : '';
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const base = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const dashboardUrl = `${base}/dashboard/challenges`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'FitSphere';
  const headline = 'Challenge & community updates';
  const listItems = challenges
    .slice(0, 10)
    .map((c) => {
      const end = c.endDate ? new Date(c.endDate) : null;
      const endStr = end
        ? end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : '';
      const safeTitle = escapeHtmlText(c.title || '');
      const line = endStr ? `${safeTitle} — ends ${endStr}` : safeTitle;
      return `<li style="margin:0 0 8px;color:#374151;">${line}</li>`;
    })
    .join('');
  const innerHtml = `<p style="margin:0 0 12px;color:#4b5563;">Here’s what’s live on the challenge board:</p><ul style="margin:0 0 16px;padding-left:20px;">${listItems}</ul><p style="margin:0;color:#4b5563;">Open the leaderboard anytime—no join required.</p>`;
  const html = baseDigestHtml({ greeting, headline, innerHtml, dashboardUrl });
  const subject = 'FitSphere — challenge updates';
  const text = `FitSphere\n\n${headline}\n\n${challenges.map((c) => c.title).join('\n')}\n\n${dashboardUrl}\n`;
  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

/**
 * Rolling 7-day stats (weekly job).
 */
async function sendWeeklyProgressSummaryEmail(to, opts) {
  const transport = createTransport();
  if (!transport) return { sent: false };
  const {
    firstName,
    streakDays,
    workoutsCompletedThisWeek,
    weeklyMinutes,
    weeklyWorkoutTarget,
  } = opts;
  const name = firstName ? String(firstName).trim() : '';
  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const base = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const dashboardUrl = `${base}/dashboard/analytics`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'FitSphere';
  const headline = 'Your weekly progress summary';
  const innerHtml = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px;">
  <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Current streak</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${streakDays} day${streakDays === 1 ? '' : 's'}</td></tr>
  <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Workouts (last 7 days)</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${workoutsCompletedThisWeek}</td></tr>
  <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Active minutes (last 7 days)</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${Math.round(weeklyMinutes)}</td></tr>
  <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Weekly target (from your goal)</td><td style="padding:8px 0;text-align:right;font-weight:600;">${weeklyWorkoutTarget} workouts</td></tr>
</table>`;
  const html = baseDigestHtml({ greeting, headline, innerHtml, dashboardUrl });
  const subject = 'Your FitSphere weekly progress summary';
  const text = `FitSphere weekly summary\n\nStreak: ${streakDays} days\nWorkouts (7d): ${workoutsCompletedThisWeek}\nMinutes (7d): ${Math.round(weeklyMinutes)}\nTarget: ${weeklyWorkoutTarget} workouts/week\n\n${dashboardUrl}\n`;
  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

module.exports = {
  isSmtpConfigured,
  sendNotificationPreferenceEnabledEmail,
  PREFERENCE_COPY,
  sendWorkoutReminderEmail,
  sendChallengeDigestEmail,
  sendWeeklyProgressSummaryEmail,
};
