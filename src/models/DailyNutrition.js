const mongoose = require('mongoose');

const dailyNutritionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayKey: { type: String, required: true },
    foodCalories: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

dailyNutritionSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

module.exports = mongoose.model('DailyNutrition', dailyNutritionSchema);
