const mongoose = require('mongoose');

const internalMessageSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, default: '(no subject)' },
    body: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

internalMessageSchema.index({ toUserId: 1, createdAt: -1 });
internalMessageSchema.index({ fromUserId: 1, createdAt: -1 });

module.exports = mongoose.model('InternalMessage', internalMessageSchema);
