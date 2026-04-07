const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const InternalMessage = require('../models/InternalMessage');

const router = express.Router();

function formatUser(u) {
  if (!u) return null;
  const o = u._id ? u : { _id: u };
  const id = o._id?.toString?.() || o.id;
  const email = o.email || '';
  return {
    id,
    name: o.firstName || o.name || (email ? email.split('@')[0] : 'Member'),
    email,
    username: o.username || null,
  };
}

function normalizeRecipient(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('@')) return { type: 'email', value: s };
  return { type: 'username', value: s };
}

async function findRecipient(q) {
  if (!q) return null;
  if (q.type === 'email') return User.findOne({ email: q.value }).select('-passwordHash');
  return User.findOne({ username: q.value }).select('-passwordHash');
}

function isBlocked(viewer, other) {
  const ids = (viewer.blockedUserIds || []).map((id) => id.toString());
  return ids.includes(other._id.toString());
}

/** GET /messages/inbox */
router.get('/inbox', async (req, res) => {
  try {
    const list = await InternalMessage.find({ toUserId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('fromUserId', 'firstName name email username')
      .lean();

    const messages = list.map((m) => ({
      id: m._id.toString(),
      subject: m.subject,
      bodyPreview: (m.body || '').slice(0, 140),
      readAt: m.readAt,
      createdAt: m.createdAt,
      from: formatUser(m.fromUserId),
    }));
    return res.json({ messages });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load inbox' });
  }
});

/** GET /messages/sent */
router.get('/sent', async (req, res) => {
  try {
    const list = await InternalMessage.find({ fromUserId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('toUserId', 'firstName name email username')
      .lean();

    const messages = list.map((m) => ({
      id: m._id.toString(),
      subject: m.subject,
      bodyPreview: (m.body || '').slice(0, 140),
      createdAt: m.createdAt,
      to: formatUser(m.toUserId),
    }));
    return res.json({ messages });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load sent messages' });
  }
});

/** GET /messages/blocked */
router.get('/blocked', async (req, res) => {
  try {
    const u = await User.findById(req.user._id).populate('blockedUserIds', 'firstName name email username').lean();
    const blocked = (u.blockedUserIds || []).map((b) => formatUser(b));
    return res.json({ blocked });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load blocked list' });
  }
});

/** POST /messages/block */
router.post(
  '/block',
  [body('userId').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const uid = req.body.userId;
      if (!mongoose.Types.ObjectId.isValid(uid)) return res.status(400).json({ error: 'Invalid user' });
      if (uid === req.user._id.toString()) return res.status(400).json({ error: 'Invalid action' });
      const other = await User.findById(uid);
      if (!other) return res.status(404).json({ error: 'User not found' });
      const ids = req.user.blockedUserIds || [];
      if (!ids.some((id) => id.toString() === uid)) {
        req.user.blockedUserIds = [...ids, other._id];
        await req.user.save();
      }
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not update block list' });
    }
  }
);

/** DELETE /messages/block/:userId */
router.delete('/block/:userId', async (req, res) => {
  try {
    const uid = req.params.userId;
    req.user.blockedUserIds = (req.user.blockedUserIds || []).filter((id) => id.toString() !== uid);
    await req.user.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not unblock' });
  }
});

/** POST /messages — send */
router.post(
  '/',
  [body('to').notEmpty().trim(), body('subject').optional().isString(), body('body').optional().isString()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const q = normalizeRecipient(req.body.to);
      const recipient = await findRecipient(q);
      if (!recipient) return res.status(404).json({ error: 'Member not found. Use their email or username.' });
      if (recipient._id.equals(req.user._id)) {
        return res.status(400).json({ error: 'You cannot message yourself.' });
      }

      const from = await User.findById(req.user._id);
      const toU = await User.findById(recipient._id);
      if (isBlocked(from, toU) || isBlocked(toU, from)) {
        return res.status(403).json({ error: 'Messaging is not available for this member.' });
      }

      const msg = await InternalMessage.create({
        fromUserId: from._id,
        toUserId: toU._id,
        subject: String(req.body.subject || '(no subject)').slice(0, 200),
        body: String(req.body.body || '').slice(0, 10000),
      });
      return res.status(201).json({ ok: true, messageId: msg._id.toString() });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Could not send message' });
    }
  }
);

/** GET /messages/:id — read (marks read if you are recipient) */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const m = await InternalMessage.findById(id)
      .populate('fromUserId', 'firstName name email username')
      .populate('toUserId', 'firstName name email username');

    if (!m) return res.status(404).json({ error: 'Message not found' });

    const uid = req.user._id.toString();
    const fromId = m.fromUserId._id?.toString?.() || m.fromUserId.toString();
    const toId = m.toUserId._id?.toString?.() || m.toUserId.toString();
    if (fromId !== uid && toId !== uid) return res.status(403).json({ error: 'Forbidden' });

    if (toId === uid && !m.readAt) {
      m.readAt = new Date();
      await m.save();
    }

    return res.json({
      message: {
        id: m._id.toString(),
        subject: m.subject,
        body: m.body,
        createdAt: m.createdAt,
        readAt: m.readAt,
        from: formatUser(m.fromUserId),
        to: formatUser(m.toUserId),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not load message' });
  }
});

module.exports = router;
