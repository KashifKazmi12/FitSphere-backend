const mongoose = require('mongoose');

const onboardingDraftSchema = new mongoose.Schema(
  {
    data: { type: Object, required: true },
  },
  { timestamps: true }
);

onboardingDraftSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model('OnboardingDraft', onboardingDraftSchema);
