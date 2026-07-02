const { stores } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class SessionService {
  async getSession(openid) {
    let session = stores.sessions.findOne(openid);
    if (!session) {
      session = this.createDefault(openid);
    }
    return session;
  }

  createDefault(openid) {
    return stores.sessions.saveDoc(openid, {
      openid,
      step: 'idle',
      tempActivityName: null,
      tempPlannedDuration: null,
      updatedAt: new Date().toISOString()
    });
  }

  async updateSession(openid, updates) {
    const session = await this.getSession(openid);
    return stores.sessions.saveDoc(openid, { ...session, ...updates });
  }

  async clearTemp(openid) {
    return this.updateSession(openid, {
      step: 'idle',
      tempActivityName: null,
      tempPlannedDuration: null
    });
  }
}

module.exports = new SessionService();
