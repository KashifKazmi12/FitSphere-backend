const mongoose = require('mongoose');

/** PRD §3 WorkoutSession */
const workoutSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workoutId: { type: String, required: true },
    status: { type: String, enum: ['completed', 'skipped', 'in_progress'], default: 'completed' },
    metrics: {
      timeMinutes: { type: Number, default: null },
      calories: { type: Number, default: null },
      feedback: { type: String, default: '' },
      difficulty: { type: String, enum: ['beginner', 'moderate', 'advanced'], default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);
