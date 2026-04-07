/**
 * Proxy wger exercise public API — search catalog for Exercise Database tab.
 * GET /catalog/exercise/search?q=bench
 *
 * Uses /exerciseinfo/ (not /exercise/): wger v2 list/detail for `exercise` no longer
 * embeds name/description; those live on exerciseinfo.translations[].
 */
const express = require('express');
const { authRequired, loadUser } = require('../middleware/auth');

const router = express.Router();

const WGER = process.env.WGER_API_URL || 'https://wger.de/api/v2';

/** wger language id for English (see /api/v2/language/) */
const LANG_EN = 2;

const fetchHeaders = {
  Accept: 'application/json',
  'User-Agent': 'FitSphere/1.0 (exercise search; contact: dev@localhost)',
};

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickTranslation(translations) {
  if (!Array.isArray(translations) || translations.length === 0) return null;
  const en = translations.find((t) => t.language === LANG_EN && t.name && String(t.name).trim());
  if (en) return en;
  const named = translations.find((t) => t.name && String(t.name).trim());
  return named || translations[0];
}

router.get('/search', authRequired, loadUser, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ exercises: [] });

  try {
    const url = `${WGER}/exerciseinfo/?language=${LANG_EN}&limit=40&search=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: fetchHeaders });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ error: 'Exercise search failed', exercises: [] });
    }
    const results = data.results || [];
    const exercises = results.map((info) => {
      const tr = pickTranslation(info.translations);
      const name = (tr && tr.name && String(tr.name).trim()) || `Exercise ${info.id}`;
      const description = stripHtml(tr && tr.description);
      return {
        id: info.id,
        name,
        description,
        category: info.category && info.category.name ? info.category.name : undefined,
      };
    });
    return res.json({ exercises, source: 'wger' });
  } catch (e) {
    console.error('[catalogExercise]', e.message);
    return res.status(500).json({ error: 'Could not search exercises', exercises: [] });
  }
});

module.exports = router;
