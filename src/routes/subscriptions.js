const express = require('express');
const { body, validationResult } = require('express-validator');
const { authRequired, loadUser } = require('../middleware/auth');
const Subscription = require('../models/Subscription');

const router = express.Router();

/**
 * POST /subscriptions/confirm-checkout
 * Confirms a completed Stripe Checkout session and upgrades the user immediately.
 * Use this on the success redirect when webhooks are not reachable (e.g. local dev).
 */
router.post(
  '/confirm-checkout',
  authRequired,
  loadUser,
  [body('sessionId').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      return res.status(503).json({ error: 'Billing is not configured.' });
    }

    const stripe = require('stripe')(key);
    const sessionId = String(req.body.sessionId).trim();
    // Stripe Checkout Session ids: cs_test_... / cs_live_... (underscores allowed)
    if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
      return res.status(400).json({ error: 'Invalid session id.' });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.client_reference_id !== req.user._id.toString()) {
        return res.status(403).json({ error: 'This checkout does not belong to your account.' });
      }

      if (session.mode !== 'subscription') {
        return res.status(400).json({ error: 'Invalid checkout session.' });
      }

      if (session.status !== 'complete') {
        return res.status(400).json({ error: 'Checkout is not complete yet.' });
      }

      const paid =
        session.payment_status === 'paid' ||
        session.payment_status === 'no_payment_required';
      if (!paid) {
        return res.status(400).json({ error: 'Payment was not completed.' });
      }

      req.user.subscriptionPlan = 'premium';
      await req.user.save();

      let sub = await Subscription.findOne({ userId: req.user._id });
      if (!sub) {
        sub = new Subscription({
          userId: req.user._id,
          plan: 'premium',
          status: 'active',
          startDate: new Date(),
        });
      } else {
        sub.plan = 'premium';
        sub.status = 'active';
      }
      if (session.customer) sub.stripeCustomerId = String(session.customer);
      if (session.subscription) sub.stripeSubscriptionId = String(session.subscription);
      await sub.save();

      return res.json({ ok: true, plan: 'premium' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not confirm checkout' });
    }
  }
);

/** GET /subscriptions — current subscription record */
router.get('/', authRequired, loadUser, async (req, res) => {
  try {
    let sub = await Subscription.findOne({ userId: req.user._id });
    if (!sub) {
      sub = await Subscription.create({
        userId: req.user._id,
        plan: req.user.subscriptionPlan || 'free',
        status: 'active',
        startDate: new Date(),
      });
    }
    return res.json({
      subscriptions: [
        {
          subscriptionId: sub._id.toString(),
          userId: req.user._id.toString(),
          plan: sub.plan,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
        },
      ],
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load subscription' });
  }
});

module.exports = router;
