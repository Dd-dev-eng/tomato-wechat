const cron = require('node-cron');
const { stores } = require('../config/database');
const wechatService = require('./wechatService');

class ReminderService {
  start() {
    // 晨间提醒 - 每天8点
    cron.schedule('0 8 * * *', async () => {
      await this.sendMorningReminders();
    });

    // 每分钟检查活动是否超时
    cron.schedule('* * * * *', async () => {
      await this.checkActivityReminders();
    });

    console.log('✅ 定时提醒服务已启动');
  }

  async sendMorningReminders() {
    console.log('发送晨间提醒...');
    try {
      const users = stores.users.findAll(u => u.isSubscribed === true);
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

    // 检查时间到的活动
    const timeUpActivities = stores.activities.findAll(
      a => a.status === 'ongoing' && !a.isTimeUpReminderSent
    );

    for (const activity of timeUpActivities) {
      const plannedEndTime = new Date(new Date(activity.startTime).getTime() + activity.plannedDuration * 60 * 1000);
      if (now >= plannedEndTime) {
        try {
          await wechatService.sendTextMessage(
            activity.openid,
            `【${activity.name}】时间到！⏰\n\n点击菜单「结束」完成活动，收获完美番茄～ 🍅`
          );
          activity.isTimeUpReminderSent = true;
          stores.activities.saveDoc(activity._id, activity);
        } catch (error) {
          console.error(`发送时间到提醒失败:`, error.message);
        }
      }
    }

    // 检查超时30分钟以上的活动
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const timeoutActivities = stores.activities.findAll(
      a => a.status === 'ongoing' &&
        !a.isTimeoutReminderSent &&
        new Date(a.startTime) <= thirtyMinutesAgo
    );

    for (const activity of timeoutActivities) {
      if (activity.isTimeUpReminderSent) {
        try {
          await wechatService.sendTextMessage(
            activity.openid,
            `【${activity.name}】已经超时很久了哦～\n\n点击菜单「结束」完成活动，或直接开始下一个活动吧！`
          );
          activity.isTimeoutReminderSent = true;
          stores.activities.saveDoc(activity._id, activity);
        } catch (error) {
          console.error(`发送超时提醒失败:`, error.message);
        }
      }
    }
  }
}

module.exports = new ReminderService();
