const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    /** Set only for Google OAuth. Omit on email/password signup so we do not store null (unique index would block multiple users). */
    googleId: { type: String },

    firstName: { type: String, default: '' },
    name: { type: String, default: '' },

    goals: [{ type: String }],
    barriers: [{ type: String }],

    sex: { type: String, enum: ['male', 'female'], default: 'male' },
    birthDate: { type: Date, default: null },
    country: { type: String, default: '' },

    heightFeet: { type: Number, default: null },
    heightInches: { type: Number, default: null },
    heightCm: { type: Number, default: null },
    useMetricHeight: { type: Boolean, default: false },

    currentWeightLbs: { type: Number, default: null },
    goalWeightLbs: { type: Number, default: null },
    useMetricWeight: { type: Boolean, default: false },

    weeklyGoal: { type: String, default: '' },

    /** PRD §3 User + §5.1 onboarding — preferences & assessment */
    activityLevel: {
      type: String,
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
      default: 'light',
    },
    preferredTimeAvailability: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'flexible'],
      default: 'flexible',
    },
    workoutIntensity: {
      type: String,
      enum: ['beginner', 'moderate', 'advanced'],
      default: 'moderate',
    },
    availableEquipment: [{ type: String }],

    onboardingComplete: { type: Boolean, default: true },

    reminderPreferences: {
      workoutReminders: { type: Boolean, default: true },
      challengeUpdates: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: true },
    },

    subscriptionPlan: { type: String, enum: ['free', 'premium'], default: 'free' },
  },
  { timestamps: true }
);

/** Unique only when googleId is a real string — allows many users without Google. */
userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $exists: true, $type: 'string' } },
  }
);

module.exports = mongoose.model('User', userSchema);
