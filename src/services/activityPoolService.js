const DailyActivityPool = require('../models/DailyActivityPool');
const { getTodayDateString } = require('../utils/dateHelper');

class ActivityPoolService {
  async getTodayPool(openid) {
    const date = getTodayDateString();
    let pool = await DailyActivityPool.findOne({ openid, date });
    if (!pool) {
      pool = await DailyActivityPool.create({
        openid,
        date,
        activities: []
      });
    }
    return pool;
  }

  async addActivity(openid, activityName) {
    const date = getTodayDateString();
    const pool = await DailyActivityPool.findOneAndUpdate(
      { openid, date },
      { $addToSet: { activities: activityName } },
      { new: true, upsert: true }
    );
    return pool;
  }

  async removeActivity(openid, activityName) {
    const date = getTodayDateString();
    return await DailyActivityPool.findOneAndUpdate(
      { openid, date },
      { $pull: { activities: activityName } },
      { new: true }
    );
  }

  async setActivities(openid, activities) {
    const date = getTodayDateString();
    return await DailyActivityPool.findOneAndUpdate(
      { openid, date },
      { activities },
      { new: true, upsert: true }
    );
  }
}

module.exports = new ActivityPoolService();
