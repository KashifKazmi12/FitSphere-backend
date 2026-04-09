const mongoose = require('mongoose');

const callbacksSchema = new mongoose.Schema({
  logs: {
    type: Object,
    required: true,
  },
});

const Callbacks = mongoose.model('Callbacks', callbacksSchema);

module.exports = Callbacks;