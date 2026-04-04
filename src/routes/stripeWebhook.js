const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

module.exports = async function stripeWebhook(req, res) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!key || !secret) {
    return res.status(503).send('Stripe webhook not configured');
  }

  const stripe = require('stripe')(key);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[stripe webhook]', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.client_reference_id;
      if (uid && session.mode === 'subscription' && mongoose.Types.ObjectId.isValid(uid)) {
        const userId = new mongoose.Types.ObjectId(uid);
        const user = await User.findById(userId);
        if (user) {
          user.subscriptionPlan = 'premium';
          await user.save();
        }
        let sub = await Subscription.findOne({ userId });
        if (!sub) {
          sub = new Subscription({
            userId,
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
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subObj = event.data.object;
      const sub = await Subscription.findOne({ stripeSubscriptionId: subObj.id });
      if (sub) {
        sub.status = 'canceled';
        sub.plan = 'free';
        await sub.save();
        const user = await User.findById(sub.userId);
        if (user) {
          user.subscriptionPlan = 'free';
          await user.save();
        }
      }
    }
  } catch (e) {
    console.error('[stripe webhook handler]', e);
    return res.status(500).send('Webhook handler failed');
  }

  res.json({ received: true });
};
