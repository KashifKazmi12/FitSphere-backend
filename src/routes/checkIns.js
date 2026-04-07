const express = require('express');
const { body, validationResult } = require('express-validator');
const BodyCheckIn = require('../models/BodyCheckIn');

const router = express.Router();

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** GET /check-ins — recent entries (newest first) */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(90, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const checkIns = await BodyCheckIn.find({ userId: req.user._id })
      .sort({ dayKey: -1 })
      .limit(limit)
      .lean();
    return res.json({ checkIns });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load check-ins' });
  }
});

/** POST /check-ins — upsert today (UTC) and update profile weight when weight provided */
router.post(
  '/',
  [
    body('weightLbs').optional().isFloat({ min: 20, max: 800 }),
    body('neckIn').optional().isFloat({ min: 5, max: 60 }),
    body('waistIn').optional().isFloat({ min: 10, max: 80 }),
    body('hipsIn').optional().isFloat({ min: 10, max: 80 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const dayKey = utcDayKey();
      let doc = await BodyCheckIn.findOne({ userId: req.user._id, dayKey });
      if (!doc) {
        doc = new BodyCheckIn({ userId: req.user._id, dayKey });
      }
      const b = req.body;
      if (b.weightLbs != null && b.weightLbs !== '') doc.weightLbs = Math.round(Number(b.weightLbs) * 10) / 10;
      if (b.neckIn != null && b.neckIn !== '') doc.neckIn = Math.round(Number(b.neckIn) * 10) / 10;
      if (b.waistIn != null && b.waistIn !== '') doc.waistIn = Math.round(Number(b.waistIn) * 10) / 10;
      if (b.hipsIn != null && b.hipsIn !== '') doc.hipsIn = Math.round(Number(b.hipsIn) * 10) / 10;

      const hasAny =
        doc.weightLbs != null || doc.neckIn != null || doc.waistIn != null || doc.hipsIn != null;
      if (!hasAny) {
        return res.status(400).json({ error: 'Enter at least one measurement.' });
      }

      await doc.save();

      if (doc.weightLbs != null && Number.isFinite(doc.weightLbs)) {
        req.user.currentWeightLbs = doc.weightLbs;
        await req.user.save();
      }

      return res.json({ ok: true, checkIn: doc.toObject() });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not save check-in' });
    }
  }
);

module.exports = router;
