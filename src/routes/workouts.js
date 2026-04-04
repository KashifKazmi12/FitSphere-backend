const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRequired, loadUser } = require('../middleware/auth');
const WorkoutPlan = require('../models/WorkoutPlan');
const {
  generatePlanEntries,
  buildPlanEntriesFromUser,
  defaultVideosForTags,
} = require('../services/workoutPlanGenerator');

const router = express.Router();

function entriesToStoredWorkouts(entries) {
  return entries.map((e) => ({
    day: e.day,
    workoutId: e.workoutId,
    title: e.title,
    description: e.description || '',
    durationMinutes: e.durationMinutes,
    difficulty: e.difficulty,
    tags: e.tags || [],
    scheduledLabel: e.scheduledLabel || e.day,
    videoUrls: Array.isArray(e.videoUrls) ? e.videoUrls : [],
  }));
}

function storedToEntries(planDoc) {
  return (planDoc.workouts || []).map((w) => ({
    day: w.day,
    workoutId: w.workoutId,
    title: w.title,
    description: w.description || '',
    durationMinutes: w.durationMinutes,
    difficulty: w.difficulty,
    tags: w.tags || [],
    scheduledLabel: w.scheduledLabel || w.day,
    videoUrls: w.videoUrls || [],
  }));
}

function groupByDay(entries) {
  const byDay = {};
  entries.forEach((e) => {
    const k = e.day || 'Other';
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(e);
  });
  return byDay;
}

/** POST /workouts — generate plan (OpenAI when configured, else rules) */
router.post(
  '/',
  authRequired,
  loadUser,
  [body('regenerate').optional().isBoolean()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { entries, source } = await generatePlanEntries(req.user);
      const goal = (req.user.goals && req.user.goals.join(', ')) || '';
      await WorkoutPlan.findOneAndDelete({ userId: req.user._id });
      const plan = await WorkoutPlan.create({
        userId: req.user._id,
        goal,
        workouts: entriesToStoredWorkouts(entries),
      });
      const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
      const isPremium = req.user.subscriptionPlan === 'premium';
      return res.status(201).json({
        planId: plan._id.toString(),
        planSource: source,
        subscriptionTier: isPremium ? 'premium' : 'free',
        freeTierRules: !isPremium,
        openaiConfigured,
        message: 'Your personalized plan is ready.',
        workouts: entries,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not generate plan' });
    }
  }
);

/** GET /workouts — saved plan from DB, or samples */
router.get('/', authRequired, loadUser, async (req, res) => {
  try {
    const plan = await WorkoutPlan.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    if (plan && plan.workouts.length) {
      const entries = storedToEntries(plan);
      const isPremium = req.user.subscriptionPlan === 'premium';
      return res.json({
        planId: plan._id.toString(),
        message: 'Your current plan.',
        workouts: entries,
        byDay: groupByDay(entries),
        subscriptionTier: isPremium ? 'premium' : 'free',
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      });
    }
    const fallback = buildPlanEntriesFromUser(req.user);
    const isPremium = req.user.subscriptionPlan === 'premium';
    return res.json({
      message: 'Generate a plan to get your full week.',
      workouts: fallback,
      byDay: groupByDay(fallback),
      subscriptionTier: isPremium ? 'premium' : 'free',
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not list workouts' });
  }
});

const SAMPLE_DETAIL = {
  'plan-full-body': {
    title: 'Full Body — Starter',
    description: 'Foundational strength and mobility for your goals.',
    duration: 28,
    difficulty: 'beginner',
    videoUrls: ['https://www.youtube.com/watch?v=IODxDxX7oi4'],
    cues: ['Brace your core', 'Full range of motion', 'Breathe steadily'],
  },
  'plan-core': {
    title: 'Core & Stability',
    description: 'Short session focused on trunk strength.',
    duration: 15,
    difficulty: 'beginner',
    videoUrls: ['https://www.youtube.com/watch?v=1919eTCoKVs'],
    cues: ['Keep lower back neutral', 'Move with control'],
  },
  'plan-cardio': {
    title: 'Cardio Intervals',
    description: 'Interval work scaled to your intensity preference.',
    duration: 22,
    difficulty: 'moderate',
    videoUrls: ['https://www.youtube.com/watch?v=ml6cT4AZdqI'],
    cues: ['Warm up first', 'Recover between rounds'],
  },
};

/** GET /workouts/:id — prefer session from user's saved plan (including OpenAI-generated ids) */
router.get('/:id', authRequired, loadUser, async (req, res) => {
  const id = req.params.id;
  try {
    const plan = await WorkoutPlan.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    const w = plan?.workouts?.find((x) => x.workoutId === id);
    if (w) {
      const tagCues = (w.tags || []).slice(0, 5).map((t) => `Include: ${t}`);
      const cues =
        tagCues.length > 0 ? tagCues : ['Warm up first', 'Follow your pacing', 'Finish with a cool-down'];
      const videoUrls =
        w.videoUrls && w.videoUrls.length ? w.videoUrls : defaultVideosForTags(w.tags);
      return res.json({
        workoutId: id,
        title: w.title,
        description: w.description || '',
        duration: w.durationMinutes || 30,
        difficulty: w.difficulty || 'moderate',
        videoUrls,
        cues,
      });
    }
  } catch (e) {
    console.error(e);
  }

  const base = SAMPLE_DETAIL[id] || {
    title: 'Workout',
    description: 'Session from your personalized plan.',
    duration: 30,
    difficulty: 'moderate',
    videoUrls: [],
    cues: ['Warm up', 'Follow the plan', 'Cool down'],
  };
  res.json({
    workoutId: id,
    ...base,
  });
});

module.exports = router;
