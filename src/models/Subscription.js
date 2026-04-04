const mongoose = require('mongoose');

/** PRD §3 Subscription */
const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    status: { type: String, enum: ['active', 'canceled', 'past_due'], default: 'active' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
