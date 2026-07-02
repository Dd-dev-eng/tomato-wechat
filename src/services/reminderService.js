const cron = require('node-cron');
const User = require('../models/User');
const Activity = require('../models/Activity');
const wechatService = require('./wechatService');

class ReminderService {
  start() {
    cron.schedule('0 8 * * *', async () => {
      await this.sendMorningReminders();
    });

    cron.schedule('* * * * *', async () => {
      await this.checkActivityReminders();
    });

    console.log('定时提醒服务已启动');
  }

  async sendMorningReminders() {
    console.log('开始发送晨间提醒...');
    try {
      const users = await User.find({ isSubscribed: true });
      for (const user of users) {
        try {
          await wechatService.sendTextMessage(
            user.openid,
            '早上好！☀️\n\n今天你想把时间花在哪几个活动上？\n\n发送「添加活动 xxx」来设定今日活动池吧～'
          );
        } catch (error) {
          console.error(`给用户 ${user.openid} 发送晨间提醒失败:`, error.message);
        }
      }
    } catch (error) {
      console.error('发送晨间提醒出错:', error);
    }
  }

  async checkActivityReminders() {
    const now = new Date();

    const timeUpActivities = await Activity.find({
      status: 'ongoing',
      isTimeUpReminderSent: false
    });

    for (const activity of timeUpActivities) {
      const plannedEndTime = new Date(activity.startTime.getTime() + activity.plannedDuration * 60 * 1000);
      if (now >= plannedEndTime) {
        try {
          await wechatService.sendTextMessage(
            activity.openid,
            `【${activity.name}】时间到！⏰\n\n点击菜单「结束」完成活动，收获完美番茄～ 🍅`
          );
          activity.isTimeUpReminderSent = true;
          await activity.save();
        } catch (error) {
          console.error(`发送时间到提醒失败:`, error.message);
        }
      }
    }

    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const timeoutActivities = await Activity.find({
      status: 'ongoing',
      isTimeoutReminderSent: false,
      startTime: { $lte: thirtyMinutesAgo }
    });

    for (const activity of timeoutActivities) {
      if (activity.isTimeUpReminderSent) {
        try {
          await wechatService.sendTextMessage(
            activity.openid,
            `【${activity.name}】已经超时很久了哦～\n\n点击菜单「结束」完成活动，或直接开始下一个活动吧！`
          );
          activity.isTimeoutReminderSent = true;
          await activity.save();
        } catch (error) {
          console.error(`发送超时提醒失败:`, error.message);
        }
      }
    }
  }
}

module.exports = new ReminderService();
