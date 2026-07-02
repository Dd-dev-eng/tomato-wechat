const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  openid: {
    type: String,
    required: true,
    unique: true
  },
  nickname: String,
  avatar: String,
  tags: [{
    type: String
  }],
  morningReminderTime: {
    type: String,
    default: '08:00'
  },
  isSubscribed: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
