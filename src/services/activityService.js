// 内存存储，MVP 可接受重启丢失
const activities = new Map();   // id -> activity
const ongoing = new Map();      // openid -> activityId

class ActivityService {
  start(openid, name, plannedDuration) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const activity = { id, openid, name, plannedDuration, startTime: Date.now(), endTime: null, status: 'ongoing' };
    activities.set(id, activity);
    ongoing.set(openid, id);
    return activity;
  }

  getOngoing(openid) {
    const id = ongoing.get(openid);
    return id ? activities.get(id) : null;
  }

  end(openid) {
    const activity = this.getOngoing(openid);
    if (!activity) return null;
    activity.endTime = Date.now();
    activity.status = 'completed';
    ongoing.delete(openid);
    return activity;
  }
}

module.exports = new ActivityService();
