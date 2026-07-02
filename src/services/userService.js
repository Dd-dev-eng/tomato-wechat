const { stores } = require('../config/database');

class UserService {
  async findOrCreateUser(openid) {
    let user = stores.users.findOne(openid);
    if (!user) {
      user = stores.users.saveDoc(openid, {
        openid,
        isSubscribed: true,
        createdAt: new Date().toISOString()
      });
    }
    return user;
  }

  async getUser(openid) {
    return stores.users.findOne(openid);
  }

  async updateUserSubscription(openid, isSubscribed) {
    const user = await this.getUser(openid);
    if (!user) return null;
    return stores.users.saveDoc(openid, { ...user, isSubscribed });
  }
}

module.exports = new UserService();
