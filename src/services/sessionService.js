// 内存存储，MVP 可接受重启丢失
const sessions = new Map();

class SessionService {
  async get(openid) {
    if (!sessions.has(openid)) {
      sessions.set(openid, { openid, step: 'idle', tempActivityName: null });
    }
    return sessions.get(openid);
  }

  async update(openid, data) {
    const current = await this.get(openid);
    const merged = { ...current, ...data };
    sessions.set(openid, merged);
    return merged;
  }
}

module.exports = new SessionService();
