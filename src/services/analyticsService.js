/**
 * Progress analytics from WorkoutSession documents (streaks, weekly stats, trends).
 */

function dateKeyUTC(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/** Current streak: consecutive days with ≥1 completed workout, anchored on today or yesterday. */
function computeCurrentStreak(completedSessions) {
  const daySet = new Set(
    completedSessions.filter((s) => s.status === 'completed').map((s) => dateKeyUTC(s.createdAt))
  );
  if (daySet.size === 0) return 0;

  const today = dateKeyUTC(new Date());
  const yesterday = dateKeyUTC(new Date(Date.now() - 86400000));

  let anchor = null;
  if (daySet.has(today)) anchor = today;
  else if (daySet.has(yesterday)) anchor = yesterday;
  else return 0;

  let streak = 0;
  let d = new Date(anchor + 'T12:00:00.000Z');
  while (daySet.has(dateKeyUTC(d))) {
    streak += 1;
    d = new Date(d.getTime() - 86400000);
  }
  return streak;
}

/** Parse a weekly workout target from onboarding string (e.g. "3–4" → 3). Default 3. */
function parseWeeklyWorkoutTarget(weeklyGoalStr) {
  if (!weeklyGoalStr || typeof weeklyGoalStr !== 'string') return 3;
  const m = weeklyGoalStr.match(/(\d+)/);
  if (!m) return 3;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n < 1) return 3;
  return Math.min(14, n);
}

/**
 * Last `weeks` non-overlapping 7-day blocks (most recent first in array order).
 */
function buildWeeklyTrend(completedSessions, weeks = 4, now = Date.now()) {
  const endOfToday = new Date(now);
  endOfToday.setUTCHours(23, 59, 59, 999);
  const buckets = [];

  for (let w = 0; w < weeks; w += 1) {
    const blockEnd = endOfToday.getTime() - w * 7 * 86400000;
    const blockStart = blockEnd - 7 * 86400000 + 1;
    let count = 0;
    let minutes = 0;
    for (const s of completedSessions) {
      if (s.status !== 'completed') continue;
      const t = new Date(s.createdAt).getTime();
      if (t >= blockStart && t <= blockEnd) {
        count += 1;
        minutes += s.metrics?.timeMinutes || 0;
      }
    }
    buckets.push({
      periodEnd: new Date(blockEnd).toISOString().slice(0, 10),
      workoutsCompleted: count,
      minutes,
    });
  }
  return buckets.reverse();
}

module.exports = {
  dateKeyUTC,
  computeCurrentStreak,
  parseWeeklyWorkoutTarget,
  buildWeeklyTrend,
};
