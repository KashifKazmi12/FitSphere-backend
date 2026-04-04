const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const OnboardingDraft = require('../models/OnboardingDraft');
const Subscription = require('../models/Subscription');
const { mergeProfileBody } = require('../utils/mergeProfileBody');

const router = express.Router();

const JWT_SECRET = () => process.env.JWT_ACCESS_SECRET || 'change-me-access';

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, JWT_SECRET(), { expiresIn: '7d' });
}

function mergeDraftData(user, data) {
  mergeProfileBody(user, data);
  user.onboardingComplete = true;
}

async function ensureSubscriptionForUser(userId, plan) {
  const p = plan === 'premium' ? 'premium' : 'free';
  await Subscription.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, plan: p, status: 'active', startDate: new Date() } },
    { upsert: true }
  );
}

const registerValidators = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  body('draftId').notEmpty().withMessage('Complete onboarding first (draftId required)'),
];

async function registerFromDraft(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password, draftId } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(draftId)) {
      return res.status(400).json({ error: 'Invalid onboarding session id' });
    }
    const draft = await OnboardingDraft.findById(draftId);
    if (!draft) {
      return res.status(400).json({ error: 'Onboarding session expired or invalid. Start again.' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = new User({
      email,
      passwordHash,
    });
    mergeDraftData(user, draft.data);
    await user.save();
    await ensureSubscriptionForUser(user._id, user.subscriptionPlan);
    await OnboardingDraft.deleteOne({ _id: draft._id });
    const token = signToken(user._id);
    return res.status(201).json({
      token,
      user: user.toObject({
        getters: true,
        versionKey: false,
        transform: (_d, ret) => {
          delete ret.passwordHash;
          return ret;
        },
      }),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

/** PRD §4 POST /auth/signup — same as /register */
router.post('/signup', registerValidators, registerFromDraft);
router.post('/register', registerValidators, registerFromDraft);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email });
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!user.onboardingComplete) {
        return res.status(403).json({ error: 'Complete onboarding first', code: 'ONBOARDING_INCOMPLETE' });
      }
      const token = signToken(user._id);
      const u = user.toObject();
      delete u.passwordHash;
      return res.json({ token, user: u });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Login failed' });
    }
  }
);

/** Google OAuth — requires completed onboarding draft in `state` */
router.get('/google', (req, res) => {
  const draftId = req.query.draftId;
  if (!draftId) {
    return res.status(400).send('Missing draftId. Complete onboarding steps first, then use Google.');
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).send('Google sign-in is not configured (GOOGLE_CLIENT_ID).');
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`;
  const scope = encodeURIComponent('openid email profile');
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${scope}` +
    `&state=${encodeURIComponent(draftId)}` +
    '&access_type=offline&prompt=consent';
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const code = req.query.code;
  const draftId = req.query.state;
  const err = req.query.error;
  if (err) {
    return res.redirect(`${clientOrigin}/auth/callback?error=${encodeURIComponent(err)}`);
  }
  if (!code || !draftId) {
    return res.redirect(`${clientOrigin}/auth/callback?error=oauth_missing`);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/google/callback`;
  if (!clientId || !clientSecret) {
    return res.redirect(`${clientOrigin}/auth/callback?error=google_not_configured`);
  }
  try {
    const draft = await OnboardingDraft.findById(draftId);
    if (!draft) {
      return res.redirect(`${clientOrigin}/auth/callback?error=draft_expired`);
    }
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('Google token error', tokenJson);
      return res.redirect(`${clientOrigin}/auth/callback?error=token_exchange`);
    }
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await userRes.json();
    const email = profile.email;
    if (!email) {
      return res.redirect(`${clientOrigin}/auth/callback?error=no_email`);
    }
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      if (!user.googleId) {
        user.googleId = profile.sub;
      }
      mergeDraftData(user, draft.data);
      await user.save();
      await ensureSubscriptionForUser(user._id, user.subscriptionPlan);
    } else {
      user = new User({
        email: email.toLowerCase(),
        passwordHash: null,
        googleId: profile.sub,
      });
      mergeDraftData(user, draft.data);
      await user.save();
      await ensureSubscriptionForUser(user._id, user.subscriptionPlan);
    }
    await OnboardingDraft.deleteOne({ _id: draft._id });
    const token = signToken(user._id);
    return res.redirect(`${clientOrigin}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error(e);
    return res.redirect(`${clientOrigin}/auth/callback?error=server`);
  }
});

module.exports = router;
