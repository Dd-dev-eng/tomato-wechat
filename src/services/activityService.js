const { stores } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ActivityService {
  async startActivity(openid, name, plannedDuration) {
    const id = uuidv4();
    return stores.activities.saveDoc(id, {
      _id: id,
      openid,
      name,
      plannedDuration,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'ongoing',
      tomatoType: null,
      actualDuration: null,
      isTimeUpReminderSent: false,
      isTimeoutReminderSent: false,
      createdAt: new Date().toISOString()
    });
  }

  async getOngoingActivity(openid) {
    const all = stores.activities.findAll(a => a.openid === openid && a.status === 'ongoing');
    return all[0] || null;
  }

  async endActivity(openid, isEarlyEnd) {
    const activity = await this.getOngoingActivity(openid);
    if (!activity) return null;

    const now = new Date();
    const startTime = new Date(activity.startTime);
    const actualDuration = Math.round((now - startTime) / (1000 * 60));
    const tomatoType = isEarlyEnd ? 'half-ripe' : 'perfect';

    return stores.activities.saveDoc(activity._id, {
      ...activity,
      endTime: now.toISOString(),
      status: 'completed',
      actualDuration,
      tomatoType
    });
  }

  async getTodayActivities(openid) {
    const today = new Date().toISOString().split('T')[0];
    return stores.activities.findAll(a => 
      a.openid === openid && 
      a.createdAt && a.createdAt.startsWith(today)
    );
  }
}

module.exports = new ActivityService();
