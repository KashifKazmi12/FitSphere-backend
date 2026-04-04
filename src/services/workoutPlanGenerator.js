/**
 * Workout plan generation: OpenAI when OPENAI_API_KEY is set, else rules-based fallback.
 */

const VIDEO = {
  strength: 'https://www.youtube.com/watch?v=IODxDxX7oi4',
  core: 'https://www.youtube.com/watch?v=1919eTCoKVs',
  cardio: 'https://www.youtube.com/watch?v=ml6cT4AZdqI',
  mobility: 'https://www.youtube.com/watch?v=vuG_Ct0Skz0',
};

function defaultVideosForTags(tags) {
  const t = (tags || []).join(' ').toLowerCase();
  if (/cardio|interval|hiit/.test(t)) return [VIDEO.cardio];
  if (/core|stability|abs/.test(t)) return [VIDEO.core];
  if (/mobility|stretch|yoga/.test(t)) return [VIDEO.mobility];
  return [VIDEO.strength];
}

function buildPlanEntriesFromUser(user) {
  const intensity = user.workoutIntensity || 'moderate';
  const equip = (
    user.availableEquipment && user.availableEquipment.length ? user.availableEquipment : ['bodyweight']
  ).join(', ');
  const goalStr = (user.goals && user.goals[0]) || 'general fitness';
  const e1 = {
    day: 'Today',
    workoutId: 'plan-full-body',
    title: 'Full Body — Starter',
    description: `Goal-aligned session (${goalStr}). Equipment: ${equip}.`,
    durationMinutes: intensity === 'advanced' ? 40 : intensity === 'moderate' ? 28 : 20,
    difficulty: intensity,
    tags: ['strength', 'adaptive'],
    scheduledLabel: 'Today',
  };
  const e2 = {
    day: 'Tomorrow',
    workoutId: 'plan-core',
    title: 'Core & Stability',
    description: 'Trunk strength and mobility.',
    durationMinutes: 15,
    difficulty: 'beginner',
    tags: ['core'],
    scheduledLabel: 'Tomorrow',
  };
  const e3 = {
    day: 'Day 3',
    workoutId: 'plan-cardio',
    title: 'Cardio Intervals',
    description: 'Short intervals to match your time preference.',
    durationMinutes: 22,
    difficulty: 'moderate',
    tags: ['cardio'],
    scheduledLabel: 'Day 3',
  };
  return [
    { ...e1, videoUrls: defaultVideosForTags(e1.tags) },
    { ...e2, videoUrls: defaultVideosForTags(e2.tags) },
    { ...e3, videoUrls: defaultVideosForTags(e3.tags) },
  ];
}

function profileSummary(user) {
  return {
    goals: user.goals || [],
    barriers: user.barriers || [],
    workoutIntensity: user.workoutIntensity,
    activityLevel: user.activityLevel,
    preferredTimeAvailability: user.preferredTimeAvailability,
    availableEquipment: user.availableEquipment || [],
    sex: user.sex,
    weeklyGoal: user.weeklyGoal,
    firstName: user.firstName || user.name || '',
  };
}

function normalizeWorkoutEntry(w, index) {
  const day = w.day || `Day ${index + 1}`;
  const rawId = String(w.workoutId || `w-${index}-${Date.now()}`);
  const workoutId = rawId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64) || `w-${index}`;
  const tags = Array.isArray(w.tags) ? w.tags.slice(0, 10).map((t) => String(t).slice(0, 40)) : ['fitness'];
  let videoUrls = Array.isArray(w.videoUrls)
    ? w.videoUrls.slice(0, 3).map((u) => String(u).trim().slice(0, 500))
    : [];
  if (!videoUrls.length) videoUrls = defaultVideosForTags(tags);
  return {
    day,
    workoutId,
    title: String(w.title || 'Workout').slice(0, 120),
    description: String(w.description || 'Personalized session for your goals.').slice(0, 600),
    durationMinutes: Math.min(90, Math.max(10, Number(w.durationMinutes) || 30)),
    difficulty: ['beginner', 'moderate', 'advanced'].includes(w.difficulty) ? w.difficulty : 'moderate',
    tags,
    scheduledLabel: String(w.scheduledLabel || day).slice(0, 40),
    videoUrls,
  };
}

/**
 * Premium: OpenAI when OPENAI_API_KEY is set (else rules). Free: always rules-based plan.
 * @returns {Promise<{ entries: object[], source: 'openai' | 'rules' }>}
 */
async function generatePlanEntries(user) {
  const isPremium = user.subscriptionPlan === 'premium';
  if (!isPremium) {
    return { entries: buildPlanEntriesFromUser(user), source: 'rules' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return { entries: buildPlanEntriesFromUser(user), source: 'rules' };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const system = `You are an expert fitness coach for FitSphere. Generate a personalized first-week workout plan.
Respond with JSON only (no markdown), using this exact structure:
{
  "workouts": [
    {
      "day": "Today" | "Tomorrow" | "Day 3" | etc.,
      "workoutId": "unique-kebab-id",
      "title": "short title",
      "description": "1-2 sentences: what to do and why it fits this user",
      "durationMinutes": 20,
      "difficulty": "beginner" | "moderate" | "advanced",
      "tags": ["strength", "mobility"],
      "scheduledLabel": "label shown in UI, e.g. Today",
      "videoUrls": ["optional: 1-2 https links to reputable follow-along fitness videos"]
    }
  ]
}
Include 5–7 workouts (one per day for week one). Respect the user's goals, equipment, and intensity. Vary focus (strength, cardio, mobility, core) across the week. Prefer realistic public video URLs or omit videoUrls (they will be filled automatically).`;

  const userContent = `User profile (JSON):\n${JSON.stringify(profileSummary(user), null, 2)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI API error', res.status, errText);
      return { entries: buildPlanEntriesFromUser(user), source: 'rules' };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { entries: buildPlanEntriesFromUser(user), source: 'rules' };
    }

    const parsed = JSON.parse(content);
    const raw = parsed.workouts;
    if (!Array.isArray(raw) || raw.length < 3) {
      return { entries: buildPlanEntriesFromUser(user), source: 'rules' };
    }

    const entries = raw.slice(0, 10).map((w, i) => normalizeWorkoutEntry(w, i));
    return { entries, source: 'openai' };
  } catch (e) {
    console.error('OpenAI workout plan failed, using rules fallback:', e.message || e);
    return { entries: buildPlanEntriesFromUser(user), source: 'rules' };
  }
}

module.exports = {
  buildPlanEntriesFromUser,
  generatePlanEntries,
  defaultVideosForTags,
};
