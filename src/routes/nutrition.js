const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRequired, loadUser } = require('../middleware/auth');
const WorkoutSession = require('../models/WorkoutSession');
const DailyNutrition = require('../models/DailyNutrition');
const { computeDailyNetCalories } = require('../services/nutritionGoal');
const { estimateBurnedCalories } = require('../services/exerciseCalories');

const router = express.Router();

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function dayBoundsUtc(dayKey) {
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(`${dayKey}T23:59:59.999Z`);
  return { start, end };
}

/** GET /nutrition/summary — today's calorie math for the dashboard */
router.get('/summary', authRequired, loadUser, async (req, res) => {
  try {
    const dayKey = typeof req.query.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day)
      ? req.query.day
      : utcDayKey();
    const { start, end } = dayBoundsUtc(dayKey);

    const g = computeDailyNetCalories(req.user);
    const calorieGoal = g.ok ? g.dailyNetCalories : 2000;

    const daily = await DailyNutrition.findOne({ userId: req.user._id, dayKey }).lean();
    const foodCalories = Math.max(0, daily?.foodCalories || 0);

    const sessions = await WorkoutSession.find({
      userId: req.user._id,
      status: 'completed',
      createdAt: { $gte: start, $lte: end },
    }).lean();

    let exerciseCalories = 0;
    for (const s of sessions) {
      let c = s.metrics?.calories;
      if (Number.isFinite(c) && c > 0) {
        exerciseCalories += c;
        continue;
      }
      const tm = s.metrics?.timeMinutes;
      const diff = s.metrics?.difficulty || 'moderate';
      if (tm != null && tm > 0) {
        exerciseCalories += estimateBurnedCalories(req.user, tm, diff);
      }
    }

    const remainingCalories = Math.max(0, calorieGoal - foodCalories + exerciseCalories);

    return res.json({
      dayKey,
      calorieGoal,
      foodCalories,
      exerciseCalories,
      remainingCalories,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load nutrition summary' });
  }
});

/** POST /nutrition/food — add calories eaten today (UTC day) */
router.post(
  '/food',
  authRequired,
  loadUser,
  [body('calories').isFloat({ min: 0, max: 20000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const dayKey = utcDayKey();
      const add = Math.round(Number(req.body.calories));
      const doc = await DailyNutrition.findOneAndUpdate(
        { userId: req.user._id, dayKey },
        { $setOnInsert: { userId: req.user._id, dayKey }, $inc: { foodCalories: add } },
        { upsert: true, new: true }
      );
      return res.json({
        ok: true,
        dayKey,
        foodCalories: doc.foodCalories,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not update food calories' });
    }
  }
);

/** PATCH /nutrition/today — set total food calories for today (UTC) */
router.patch(
  '/today',
  authRequired,
  loadUser,
  [body('foodCalories').isFloat({ min: 0, max: 20000 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const dayKey = utcDayKey();
      const total = Math.round(Number(req.body.foodCalories));
      const doc = await DailyNutrition.findOneAndUpdate(
        { userId: req.user._id, dayKey },
        { userId: req.user._id, dayKey, foodCalories: total },
        { upsert: true, new: true }
      );
      return res.json({ ok: true, dayKey, foodCalories: doc.foodCalories });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not set food calories' });
    }
  }
);

module.exports = router;
