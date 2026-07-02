const { stores } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class ActivityService {
  async createActivity(openid, data) {
    const id = uuidv4();
    return stores.activities.saveDoc(id, {
      _id: id,
      openid,
      name: data.name,
      plannedDuration: data.plannedDuration,
      startTime: data.startTime || new Date(),
      endTime: null,
      status: 'ongoing',
      tomatoType: null,
      createdAt: new Date().toISOString()
    });
  }

  async getOngoingActivity(openid) {
    const all = stores.activities.findAll(a => a.openid === openid && a.status === 'ongoing');
    return all[0] || null;
  }

  async endActivity(activityId, tomatoType) {
    const activity = stores.activities.findOne(activityId);
    if (!activity) return null;
    return stores.activities.saveDoc(activityId, {
      ...activity,
      endTime: new Date(),
      status: 'completed',
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
