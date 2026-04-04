const mongoose = require('mongoose');

/** PRD §3 WorkoutPlan */
const workoutPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: String, default: '' },
    workouts: [
      {
        day: { type: String, default: '' },
        workoutId: { type: String, required: true },
        title: String,
        description: { type: String, default: '' },
        durationMinutes: Number,
        difficulty: String,
        tags: [{ type: String }],
        scheduledLabel: { type: String, default: '' },
        videoUrls: [{ type: String }],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);
