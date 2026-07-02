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

  // 获取今日已完成的活动记录（北京时间 0 点结算）
  getTodayActivities(openid) {
    const now = new Date();
    // 北京时间 = UTC+8，计算北京时间今天 00:00 对应的 UTC 时间戳
    const beijingTime = new Date(now.getTime() + 8 * 3600 * 1000);
    const todayStart = Date.UTC(
      beijingTime.getUTCFullYear(),
      beijingTime.getUTCMonth(),
      beijingTime.getUTCDate()
    ) - 8 * 3600 * 1000;
    const result = [];
    for (const [, a] of activities) {
      if (a.openid === openid && a.status === 'completed' && a.startTime >= todayStart) {
        result.push(a);
      }
    }
    return result.sort((a, b) => b.startTime - a.startTime);
  }
}

module.exports = new ActivityService();
