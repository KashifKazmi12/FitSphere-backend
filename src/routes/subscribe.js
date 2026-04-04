const express = require('express');
const router = express.Router();

/** POST /subscribe — Stripe Checkout when STRIPE_SECRET_KEY + STRIPE_PRICE_PREMIUM are set */
router.post('/', async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_PREMIUM?.trim();
  if (!key || !priceId) {
    return res.status(503).json({
      error: 'Billing is not configured yet. Add Stripe keys to the server environment.',
      code: 'BILLING_UNAVAILABLE',
    });
  }

  const stripe = require('stripe')(key);
  const base = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/dashboard/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/subscription?checkout=canceled`,
      client_reference_id: req.user._id.toString(),
      customer_email: req.user.email || undefined,
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
});

module.exports = router;
