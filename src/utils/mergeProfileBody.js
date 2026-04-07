/**
 * Apply PRD onboarding-style profile fields to a User document.
 * Does not set onboardingComplete (call that in registration only).
 */
function mergeProfileBody(user, data) {
  if (!data || typeof data !== 'object') return;

  if (data.username != null && String(data.username).trim()) {
    const u = String(data.username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (u.length >= 3 && u.length <= 32) user.username = u;
  }

  if (data.firstName) {
    user.firstName = String(data.firstName).trim();
    user.name = user.firstName;
  } else if (data.name != null && String(data.name).trim()) {
    user.name = String(data.name).trim();
    if (!user.firstName) user.firstName = user.name;
  }

  if (Array.isArray(data.goals)) user.goals = data.goals.slice(0, 5);
  if (Array.isArray(data.barriers)) user.barriers = data.barriers;
  if (data.sex === 'male' || data.sex === 'female') user.sex = data.sex;
  if (data.birthDate) user.birthDate = new Date(data.birthDate);
  if (data.country) user.country = String(data.country).trim();
  if (typeof data.heightFeet === 'number') user.heightFeet = data.heightFeet;
  if (typeof data.heightInches === 'number') user.heightInches = data.heightInches;
  if (typeof data.heightCm === 'number') user.heightCm = data.heightCm;
  if (typeof data.useMetricHeight === 'boolean') user.useMetricHeight = data.useMetricHeight;
  if (typeof data.currentWeightLbs === 'number') user.currentWeightLbs = data.currentWeightLbs;
  if (typeof data.goalWeightLbs === 'number') user.goalWeightLbs = data.goalWeightLbs;
  if (typeof data.useMetricWeight === 'boolean') user.useMetricWeight = data.useMetricWeight;
  if (data.weeklyGoal) user.weeklyGoal = String(data.weeklyGoal);

  const activityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
  if (data.activityLevel && activityLevels.includes(data.activityLevel)) user.activityLevel = data.activityLevel;
  const times = ['morning', 'afternoon', 'evening', 'flexible'];
  if (data.preferredTimeAvailability && times.includes(data.preferredTimeAvailability)) {
    user.preferredTimeAvailability = data.preferredTimeAvailability;
  }
  const intensities = ['beginner', 'moderate', 'advanced'];
  if (data.workoutIntensity && intensities.includes(data.workoutIntensity)) user.workoutIntensity = data.workoutIntensity;
  if (Array.isArray(data.availableEquipment)) {
    user.availableEquipment = data.availableEquipment.slice(0, 12).map(String);
  }
}

module.exports = { mergeProfileBody };
