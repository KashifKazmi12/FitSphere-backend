const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');

/**
 * Leaderboard for a challenge: all users with completed workouts in [start, end].
 * score = (completed workouts in window) × 100 + total minutes logged.
 * Joining a challenge is not required — scores come from workout sessions only.
 */
async function buildLeaderboardForChallenge(challenge) {
  const start = challenge.startDate;
  const end = challenge.endDate;

  const sessions = await WorkoutSession.find({
    status: 'completed',
    createdAt: { $gte: start, $lte: end },
  }).lean();

  const byUser = new Map();
  for (const s of sessions) {
    const uid = s.userId.toString();
    if (!byUser.has(uid)) {
      byUser.set(uid, { workouts: 0, minutes: 0 });
    }
    const row = byUser.get(uid);
    row.workouts += 1;
    row.minutes += Number(s.metrics?.timeMinutes) || 0;
  }

  const rows = [];
  for (const [uid, stats] of byUser) {
    const workoutsCompleted = stats.workouts;
    const minutes = stats.minutes;
    const score = workoutsCompleted * 100 + minutes;

    const u = await User.findById(uid).select('firstName name email').lean();
    const raw = u?.firstName || u?.name || (u?.email ? u.email.split('@')[0] : '') || 'Member';
    const displayName = String(raw).slice(0, 40);

    rows.push({
      userId: uid,
      displayName,
      score: Math.round(score),
      workoutsCompleted,
      minutes: Math.round(minutes),
    });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

/**
 * Number of distinct users with at least one completed workout in the challenge window.
 */
async function countRankedUsersForChallenge(challenge) {
  const ids = await WorkoutSession.distinct('userId', {
    status: 'completed',
    createdAt: { $gte: challenge.startDate, $lte: challenge.endDate },
  });
  return ids.length;
}

module.exports = { buildLeaderboardForChallenge, countRankedUsersForChallenge };
