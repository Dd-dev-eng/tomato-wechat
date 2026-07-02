const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  openid: {
    type: String,
    required: true,
    unique: true
  },
  step: {
    type: String,
    enum: ['idle', 'selecting_activity', 'setting_duration', 'ready_to_start', 'confirming_early_end'],
    default: 'idle'
  },
  tempActivityName: String,
  tempPlannedDuration: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UserSession', userSessionSchema);
