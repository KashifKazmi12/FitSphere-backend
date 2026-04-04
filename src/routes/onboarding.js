const express = require('express');
const { body, validationResult } = require('express-validator');
const OnboardingDraft = require('../models/OnboardingDraft');

const router = express.Router();

router.post(
  '/draft',
  [body('data').isObject().withMessage('data object required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const doc = await OnboardingDraft.create({ data: req.body.data });
      return res.status(201).json({ draftId: doc._id.toString() });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not save draft' });
    }
  }
);

module.exports = router;
