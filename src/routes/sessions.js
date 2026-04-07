const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRequired, loadUser } = require('../middleware/auth');
const WorkoutSession = require('../models/WorkoutSession');
const { estimateBurnedCalories } = require('../services/exerciseCalories');

const router = express.Router();

/** PRD §4 POST /sessions — log a workout session */
router.post(
  '/',
  authRequired,
  loadUser,
  [
    body('workoutId').notEmpty(),
    body('status').optional().isIn(['completed', 'skipped', 'in_progress']),
    body('metrics').optional().isObject(),
    body('difficulty').optional().isIn(['beginner', 'moderate', 'advanced']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const status = req.body.status || 'completed';
      const timeMinutes = req.body.metrics?.timeMinutes ?? null;
      const diffRaw = req.body.difficulty || req.body.metrics?.difficulty;
      const difficulty = ['beginner', 'moderate', 'advanced'].includes(diffRaw) ? diffRaw : 'moderate';
      let calories = req.body.metrics?.calories;
      if (status === 'completed' && (calories == null || calories === '') && timeMinutes != null) {
        calories = estimateBurnedCalories(req.user, timeMinutes, difficulty);
      }
      if (calories != null && calories !== '') calories = Math.round(Number(calories));

      const session = await WorkoutSession.create({
        userId: req.user._id,
        workoutId: String(req.body.workoutId),
        status,
        metrics: {
          timeMinutes: timeMinutes != null ? Number(timeMinutes) : null,
          calories: Number.isFinite(calories) ? calories : null,
          feedback: req.body.metrics?.feedback ?? '',
          difficulty,
        },
      });
      const obj = session.toObject();
      let exerciseCaloriesAdded = 0;
      if (status === 'completed') {
        let c = obj.metrics?.calories;
        if (!Number.isFinite(c) || c <= 0) {
          const tm = obj.metrics?.timeMinutes;
          if (tm != null && tm > 0) {
            c = estimateBurnedCalories(req.user, tm, obj.metrics?.difficulty || difficulty);
          }
        }
        if (Number.isFinite(c) && c > 0) exerciseCaloriesAdded = Math.round(c);
      }
      return res.status(201).json({
        sessionId: session._id.toString(),
        message: 'Session saved.',
        session: obj,
        exerciseCaloriesAdded,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not log session' });
    }
  }
);

router.get('/', authRequired, loadUser, async (req, res) => {
  try {
    const sessions = await WorkoutSession.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    return res.json({ sessions });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not list sessions' });
  }
});

module.exports = router;
