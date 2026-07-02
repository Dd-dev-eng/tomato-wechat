const UserSession = require('../models/UserSession');

class SessionService {
  async getSession(openid) {
    let session = await UserSession.findOne({ openid });
    if (!session) {
      session = await UserSession.create({ openid });
    }
    return session;
  }

  async updateSession(openid, updates) {
    return await UserSession.findOneAndUpdate(
      { openid },
      { ...updates, updatedAt: Date.now() },
      { new: true, upsert: true }
    );
  }

  async resetSession(openid) {
    return await UserSession.findOneAndUpdate(
      { openid },
      {
        step: 'idle',
        tempActivityName: null,
        tempPlannedDuration: null,
        updatedAt: Date.now()
      },
      { new: true, upsert: true }
    );
  }
}

module.exports = new SessionService();
