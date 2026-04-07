/**
 * Open Food Facts search — free, no API key (read-only).
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 * GET /catalog/food/search?q=apple
 */
const express = require('express');
const { authRequired, loadUser } = require('../middleware/auth');

const router = express.Router();

const OFF_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';

const fetchHeaders = {
  Accept: 'application/json',
  'User-Agent': 'FitSphere/1.0 (nutrition search; contact: dev@localhost)',
};

function round1(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Math.round(Number(v) * 10) / 10;
}

/** Map OFF product → app fields (values are per 100g when available). */
function simplifyOffProduct(p) {
  const n = p.nutriments || {};
  let kcal = round1(n['energy-kcal_100g']);
  if (kcal == null) kcal = round1(n['energy-kcal_serving']);
  if (kcal == null && n.energy_100g != null) kcal = round1(Number(n.energy_100g) / 4.184);

  let sodiumMg = null;
  if (n.sodium_100g != null) {
    const s = Number(n.sodium_100g);
    sodiumMg = Math.round(s * 1000);
  } else if (n.salt_100g != null) {
    sodiumMg = Math.round(Number(n.salt_100g) * 400);
  }

  const code = p.code || p._id;
  return {
    id: code != null ? String(code) : `off-${p.product_name || 'x'}-${Math.random().toString(36).slice(2, 9)}`,
    name: (p.product_name || p.generic_name || p.product_name_en || 'Product').trim(),
    brand: (p.brands || p.brand_owner || '')
      .split(',')[0]
      .trim(),
    calories: kcal,
    proteinG: round1(n.proteins_100g ?? n.proteins_serving),
    carbsG: round1(n.carbohydrates_100g),
    fatG: round1(n.fat_100g),
    sodiumMg,
    sugarG: round1(n.sugars_100g),
    per100g: true,
    source: 'openfoodfacts',
  };
}

router.get('/search', authRequired, loadUser, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ foods: [], message: 'Enter a search term.' });

  try {
    const params = new URLSearchParams({
      search_terms: q,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '25',
      page: '1',
    });
    const url = `${OFF_SEARCH}?${params.toString()}`;
    const r = await fetch(url, { headers: fetchHeaders });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({
        error: data.error || 'Food search failed',
        foods: [],
      });
    }
    const products = data.products || [];
    const foods = products.map(simplifyOffProduct).filter((f) => f.name);
    return res.json({ foods, configured: true, source: 'openfoodfacts' });
  } catch (e) {
    console.error('[catalogFood]', e.message);
    return res.status(500).json({ error: 'Could not search foods', foods: [] });
  }
});

module.exports = router;
