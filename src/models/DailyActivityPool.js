const mongoose = require('mongoose');

const dailyActivityPoolSchema = new mongoose.Schema({
  openid: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  activities: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

dailyActivityPoolSchema.index({ openid: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyActivityPool', dailyActivityPoolSchema);
