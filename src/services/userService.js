const { stores } = require('../config/database');

class UserService {
  async findOrCreateUser(openid) {
    let user = stores.users.findOne(openid);
    if (!user) {
      user = stores.users.saveDoc(openid, {
        openid,
        subscribed: true,
        createdAt: new Date().toISOString()
      });
    }
    return user;
  }

  async getUser(openid) {
    return stores.users.findOne(openid);
  }
}

module.exports = new UserService();
