const Activity = require('../models/Activity');
const UserSession = require('../models/UserSession');
const { getTodayDateString } = require('../utils/dateHelper');

class ActivityService {
  async getOngoingActivity(openid) {
    return await Activity.findOne({
      openid,
      status: 'ongoing'
    });
  }

  async startActivity(openid, name, plannedDuration) {
    const ongoing = await this.getOngoingActivity(openid);
    if (ongoing) {
      throw new Error('已有进行中的活动');
    }

    const activity = await Activity.create({
      openid,
      name,
      plannedDuration,
      startTime: new Date()
    });

    await UserSession.findOneAndUpdate(
      { openid },
      { step: 'idle', tempActivityName: null, updatedAt: Date.now() },
      { upsert: true }
    );

    return activity;
  }

  async endActivity(openid, isEarlyEnd = false) {
    const activity = await this.getOngoingActivity(openid);
    if (!activity) {
      throw new Error('没有进行中的活动');
    }

    const endTime = new Date();
    const actualDuration = Math.round((endTime - activity.startTime) / (1000 * 60));
    const plannedEndTime = new Date(activity.startTime.getTime() + activity.plannedDuration * 60 * 1000);

    let tomatoType;
    if (isEarlyEnd && endTime < plannedEndTime) {
      tomatoType = 'half-ripe';
    } else {
      tomatoType = 'perfect';
    }

    activity.endTime = endTime;
    activity.actualDuration = actualDuration;
    activity.status = 'completed';
    activity.tomatoType = tomatoType;

    await activity.save();
    return activity;
  }

  async cancelActivity(openid) {
    const activity = await this.getOngoingActivity(openid);
    if (!activity) {
      throw new Error('没有进行中的活动');
    }

    activity.status = 'cancelled';
    await activity.save();
    return activity;
  }

  async getTodayActivities(openid) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await Activity.find({
      openid,
      startTime: { $gte: today, $lt: tomorrow }
    }).sort({ startTime: -1 });
  }

  async getActivitiesForReminder() {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    const timeUpActivities = await Activity.find({
      status: 'ongoing',
      isTimeUpReminderSent: false
    }).where('startTime').lte(new Date(now.getTime() - this.plannedDuration * 60 * 1000));

    const timeoutActivities = await Activity.find({
      status: 'ongoing',
      isTimeoutReminderSent: false,
      startTime: { $lte: thirtyMinutesAgo }
    });

    return { timeUpActivities, timeoutActivities };
  }

  async markTimeUpReminderSent(activityId) {
    return await Activity.findByIdAndUpdate(
      activityId,
      { isTimeUpReminderSent: true }
    );
  }

  async markTimeoutReminderSent(activityId) {
    return await Activity.findByIdAndUpdate(
      activityId,
      { isTimeoutReminderSent: true }
    );
  }
}

module.exports = new ActivityService();
