const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { authRequired, loadUser } = require('../middleware/auth');
const Challenge = require('../models/Challenge');
const {
  buildLeaderboardForChallenge,
  countRankedUsersForChallenge,
} = require('../services/challengeLeaderboard');

const router = express.Router();

async function ensureSeedChallenge() {
  const count = await Challenge.countDocuments();
  if (count > 0) return;
  await Challenge.create({
    title: 'Spring consistency challenge',
    description: 'Hit 3 workouts per week for 4 weeks.',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-28'),
    participants: [],
    leaderboard: [],
  });
}

/** PRD §4 GET /challenges — list challenges */
router.get('/', authRequired, async (_req, res) => {
  try {
    await ensureSeedChallenge();
    const docs = await Challenge.find().sort({ startDate: -1 }).limit(50).lean();
    const challenges = await Promise.all(
      docs.map(async (c) => {
        const rankedCount = await countRankedUsersForChallenge(c);
        return {
          challengeId: c._id.toString(),
          title: c.title,
          description: c.description,
          startDate: c.startDate?.toISOString?.().slice(0, 10),
          endDate: c.endDate?.toISOString?.().slice(0, 10),
          rankedCount,
        };
      })
    );
    return res.json({ challenges });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not list challenges' });
  }
});

/** PRD §4 POST /challenges — create challenge (organizer / MVP open) */
router.post(
  '/',
  authRequired,
  loadUser,
  [
    body('title').trim().notEmpty(),
    body('startDate').notEmpty(),
    body('endDate').notEmpty(),
    body('description').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.user.subscriptionPlan !== 'premium') {
      return res.status(403).json({
        error: 'Creating challenges is a Premium feature. Upgrade to organize events for your community.',
        code: 'PREMIUM_REQUIRED',
      });
    }
    try {
      const c = await Challenge.create({
        title: req.body.title,
        description: req.body.description || '',
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        participants: [],
        leaderboard: [],
        createdBy: req.user._id,
      });
      return res.status(201).json({
        challengeId: c._id.toString(),
        title: c.title,
        message: 'Challenge created.',
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not create challenge' });
    }
  }
);

/** GET /challenges/:id — detail + live leaderboard from workout sessions */
router.get('/:id', authRequired, loadUser, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid challenge id' });
    }
    await ensureSeedChallenge();
    const c = await Challenge.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Challenge not found' });

    const uid = req.user._id.toString();
    const leaderboard = await buildLeaderboardForChallenge(c);
    const myRow = leaderboard.find((row) => row.userId === uid);

    return res.json({
      challengeId: c._id.toString(),
      title: c.title,
      description: c.description,
      startDate: c.startDate?.toISOString?.().slice(0, 10),
      endDate: c.endDate?.toISOString?.().slice(0, 10),
      rankedCount: leaderboard.length,
      myRank: myRow?.rank ?? null,
      myScore: myRow?.score ?? null,
      myWorkoutsCompleted: myRow?.workoutsCompleted ?? null,
      leaderboard,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load challenge' });
  }
});

module.exports = router;
