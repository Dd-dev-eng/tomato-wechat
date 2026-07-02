const { stores } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ActivityPoolService {
  async getTodayPool(openid) {
    // 默认活动池
    const key = `pool_${openid}`;
    let pool = stores.activityPools.findOne(key);
    if (!pool) {
      pool = stores.activityPools.saveDoc(key, {
        openid,
        date: new Date().toISOString().split('T')[0],
        activities: ['阅读', '学习', '运动']
      });
    }
    return pool;
  }

  async getActivities(openid) {
    const pool = await this.getTodayPool(openid);
    return pool.activities;
  }
}

module.exports = new ActivityPoolService();
