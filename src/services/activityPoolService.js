const { stores } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ActivityPoolService {
  async getTodayPool(openid) {
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

  async addActivity(openid, activityName) {
    const key = `pool_${openid}`;
    let pool = stores.activityPools.findOne(key);
    if (!pool) {
      pool = stores.activityPools.saveDoc(key, {
        openid,
        date: new Date().toISOString().split('T')[0],
        activities: [activityName]
      });
    } else {
      if (!pool.activities.includes(activityName)) {
        pool.activities.push(activityName);
        stores.activityPools.saveDoc(key, pool);
      }
    }
    return pool;
  }

  async removeActivity(openid, activityName) {
    const key = `pool_${openid}`;
    let pool = stores.activityPools.findOne(key);
    if (pool) {
      pool.activities = pool.activities.filter(a => a !== activityName);
      stores.activityPools.saveDoc(key, pool);
    }
  }
}

module.exports = new ActivityPoolService();
