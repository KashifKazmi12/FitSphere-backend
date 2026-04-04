/**
 * Mirrors frontend `lib/nutritionGoals.js` for server-side daily calorie goal.
 */
function lbsToKg(lbs) {
  return lbs * 0.45359237;
}

function heightToCm(feet, inches) {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  return f * 30.48 + i * 2.54;
}

function ageFromBirthDate(isoOrDate) {
  if (!isoOrDate) return 30;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return 30;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(13, age);
}

function bmrMifflinStJeor(weightLbs, heightFeet, heightInches, age, sex) {
  const w = lbsToKg(weightLbs);
  const h = heightToCm(heightFeet, heightInches);
  const base = 10 * w + 6.25 * h - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

const DEFAULT_ACTIVITY_FACTOR = 1.375;

function tdeeFromBmr(bmr, activityFactor = DEFAULT_ACTIVITY_FACTOR) {
  return bmr * activityFactor;
}

function parseWeeklyLbPerWeek(weeklyGoal) {
  const map = {
    lose0_5: -0.5,
    lose1: -1,
    lose1_5: -1.5,
    lose2: -2,
    gain0_25: 0.25,
    gain0_5: 0.5,
    gain0_75: 0.75,
    gain1: 1,
    maintain: 0,
  };
  return map[weeklyGoal] ?? 0;
}

function dailyCalorieAdjustmentFromWeeklyLb(weeklyLbPerWeek) {
  return weeklyLbPerWeek * 500;
}

function computeDailyNetCalories(user) {
  const cw = Number(user?.currentWeightLbs);
  const hf = Number(user?.heightFeet);
  const hi = Number(user?.heightInches);
  if (!Number.isFinite(cw) || cw <= 0) {
    return { ok: false, dailyNetCalories: 2000 };
  }
  const age = ageFromBirthDate(user?.birthDate);
  const sex = user?.sex === 'female' ? 'female' : 'male';
  const bmr = bmrMifflinStJeor(cw, hf, hi, age, sex);
  const tdee = tdeeFromBmr(bmr);
  const weeklyLb = parseWeeklyLbPerWeek(user?.weeklyGoal);
  const adjustment = dailyCalorieAdjustmentFromWeeklyLb(weeklyLb);
  const dailyNetCalories = Math.round(tdee + adjustment);
  return { ok: true, dailyNetCalories };
}

module.exports = { computeDailyNetCalories };
