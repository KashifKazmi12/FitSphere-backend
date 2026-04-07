const mongoose = require('mongoose');

/** One row per user per UTC day — weight + body measurements */
const bodyCheckInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayKey: { type: String, required: true },
    weightLbs: { type: Number, default: null },
    neckIn: { type: Number, default: null },
    waistIn: { type: Number, default: null },
    hipsIn: { type: Number, default: null },
  },
  { timestamps: true }
);

bodyCheckInSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

module.exports = mongoose.model('BodyCheckIn', bodyCheckInSchema);
