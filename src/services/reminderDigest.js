const WorkoutSession = require('../models/WorkoutSession');
const { computeCurrentStreak, parseWeeklyWorkoutTarget } = require('./analyticsService');

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** True if the user already logged at least one completed workout on this UTC calendar day. */
async function hasCompletedWorkoutOnUtcDay(userId, day = new Date()) {
  const start = startOfUtcDay(day);
  const end = new Date(start.getTime() + 86400000);
  const one = await WorkoutSession.findOne({
    userId,
    status: 'completed',
    createdAt: { $gte: start, $lt: end },
  })
    .select('_id')
    .lean();
  return !!one;
}

/** Last 7 rolling days + streak (same window as dashboard analytics). */
async function getWeekStatsForUser(user) {
  const uid = user._id;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const lookback = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const sessions = await WorkoutSession.find({
    userId: uid,
    createdAt: { $gte: lookback },
  }).lean();
  const completed = sessions.filter((s) => s.status === 'completed');
  const thisWeek = completed.filter((s) => new Date(s.createdAt).getTime() >= weekAgo);
  const weeklyMinutes = thisWeek.reduce((acc, s) => acc + (s.metrics?.timeMinutes || 0), 0);
  const streakDays = computeCurrentStreak(completed);
  const weeklyWorkoutTarget = parseWeeklyWorkoutTarget(user.weeklyGoal);
  return {
    streakDays,
    workoutsCompletedThisWeek: thisWeek.length,
    weeklyMinutes,
    weeklyWorkoutTarget,
  };
}

module.exports = {
  startOfUtcDay,
  hasCompletedWorkoutOnUtcDay,
  getWeekStatsForUser,
};
