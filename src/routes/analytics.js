const express = require('express');
const { authRequired, loadUser } = require('../middleware/auth');
const WorkoutSession = require('../models/WorkoutSession');
const {
  computeCurrentStreak,
  parseWeeklyWorkoutTarget,
  buildWeeklyTrend,
} = require('../services/analyticsService');

const router = express.Router();

router.get('/', authRequired, loadUser, async (req, res) => {
  try {
    const uid = req.user._id;
    const isPremium = req.user.subscriptionPlan === 'premium';

    const daysBack = isPremium ? 120 : 45;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const sessions = await WorkoutSession.find({
      userId: uid,
      createdAt: { $gte: since },
    })
      .lean()
      .exec();

    const completed = sessions.filter((s) => s.status === 'completed');
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekSessions = completed.filter((s) => new Date(s.createdAt).getTime() >= weekAgo);

    const weeklyMinutes = thisWeekSessions.reduce((acc, s) => acc + (s.metrics?.timeMinutes || 0), 0);
    const streakDays = computeCurrentStreak(completed);
    const weeklyWorkoutTarget = parseWeeklyWorkoutTarget(req.user.weeklyGoal);
    const workoutsCompletedThisWeek = thisWeekSessions.length;

    const goals = req.user.goals || [];
    const hasGoals = goals.length > 0;
    const goalsProgressPct = hasGoals
      ? Math.min(100, Math.round((workoutsCompletedThisWeek / Math.max(1, weeklyWorkoutTarget)) * 100))
      : null;

    const trendWeeks = isPremium ? 4 : 2;
    const weeklyTrend = buildWeeklyTrend(completed, trendWeeks);

    let trendVsPriorWeek = null;
    if (isPremium && weeklyTrend.length >= 2) {
      const priorWeek = weeklyTrend[weeklyTrend.length - 2];
      const lastWeek = weeklyTrend[weeklyTrend.length - 1];
      if (priorWeek && lastWeek) {
        trendVsPriorWeek = lastWeek.workoutsCompleted - priorWeek.workoutsCompleted;
      }
    }

    return res.json({
      analyticsTier: isPremium ? 'premium' : 'free',
      streakDays,
      weeklyMinutes,
      workoutsCompletedThisWeek,
      weeklyWorkoutTarget,
      goalsProgressPct,
      hasGoals,
      weeklyTrend,
      trendVsPriorWeek,
      totalWorkoutsCompleted: completed.length,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Analytics unavailable' });
  }
});

module.exports = router;
