/**
 * Estimate kcal burned from workout duration + intensity + body weight (MET-style).
 */
function estimateBurnedCalories(user, timeMinutes, difficulty) {
  const minutes = Math.max(0, Math.min(240, Number(timeMinutes) || 0));
  if (minutes <= 0) return 0;

  const weightLbs = Number(user?.currentWeightLbs) > 0 ? Number(user.currentWeightLbs) : 175;
  const kg = weightLbs * 0.45359237;

  let met = 5;
  if (difficulty === 'beginner') met = 4;
  else if (difficulty === 'advanced') met = 7;

  const kcal = (met * 3.5 * kg) / 200 * minutes;
  return Math.max(0, Math.round(kcal));
}

module.exports = { estimateBurnedCalories };
