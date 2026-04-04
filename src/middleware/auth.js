const jwt = require('jsonwebtoken');
const User = require('../models/User');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const secret = process.env.JWT_ACCESS_SECRET || 'change-me-access';
    const payload = jwt.verify(token, secret);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { authRequired, loadUser };
