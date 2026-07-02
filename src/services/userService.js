const User = require('../models/User');

class UserService {
  async findOrCreateUser(openid) {
    let user = await User.findOne({ openid });
    if (!user) {
      user = await User.create({ openid });
    }
    return user;
  }

  async getUser(openid) {
    return await User.findOne({ openid });
  }

  async updateUserSubscription(openid, isSubscribed) {
    return await User.findOneAndUpdate(
      { openid },
      { isSubscribed, updatedAt: Date.now() },
      { new: true }
    );
  }

  async updateUserInfo(openid, nickname, avatar) {
    return await User.findOneAndUpdate(
      { openid },
      { nickname, avatar, updatedAt: Date.now() },
      { new: true }
    );
  }

  async getTags(openid) {
    const user = await User.findOne({ openid });
    return user ? user.tags : [];
  }

  async addTag(openid, tag) {
    return await User.findOneAndUpdate(
      { openid },
      { $addToSet: { tags: tag }, updatedAt: Date.now() },
      { new: true }
    );
  }
}

module.exports = new UserService();
