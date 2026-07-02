const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  openid: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  plannedDuration: {
    type: Number,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  actualDuration: Number,
  status: {
    type: String,
    enum: ['ongoing', 'completed', 'cancelled'],
    default: 'ongoing'
  },
  tomatoType: {
    type: String,
    enum: ['perfect', 'half-ripe', null],
    default: null
  },
  isTimeUpReminderSent: {
    type: Boolean,
    default: false
  },
  isTimeoutReminderSent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Activity', activitySchema);
