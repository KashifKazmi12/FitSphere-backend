const mongoose = require('mongoose');

/** PRD §3 Challenge */
const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    leaderboard: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        displayName: String,
        score: Number,
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Challenge', challengeSchema);
