const User = require('../models/User');

/**
 * Assign a unique username from email local-part when missing (for in-app messaging).
 */
async function ensureUsername(user) {
  if (user.username && String(user.username).trim()) return;
  const raw = (user.email || '').split('@')[0] || 'member';
  const base = raw.replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'member';
  let candidate = base.slice(0, 24);
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await User.findOne({
      username: candidate,
      _id: { $ne: user._id },
    }).lean();
    if (!clash) break;
    n += 1;
    candidate = `${base.slice(0, 18)}_${n}`;
  }
  user.username = candidate;
}

module.exports = { ensureUsername };
