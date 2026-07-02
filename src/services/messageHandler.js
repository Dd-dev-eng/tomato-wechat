const wechatService = require('./wechatService');
const userService = require('./userService');
const activityPoolService = require('./activityPoolService');
const activityService = require('./activityService');
const sessionService = require('./sessionService');
const { formatDuration } = require('../utils/dateHelper');

class MessageHandler {
  async handleMessage(msg) {
    const { ToUserName, FromUserName, MsgType, Content, Event, EventKey } = msg;
    const openid = FromUserName;
    console.log(`[handleMessage] MsgType=${MsgType} Event=${Event} EventKey=${EventKey} Content=${Content}`);

    try {
      console.log('[handleMessage] 查找/创建用户...');
      await userService.findOrCreateUser(openid);
      console.log('[handleMessage] 用户 OK');

      if (MsgType === 'event') {
        return await this.handleEvent(openid, ToUserName, FromUserName, Event, EventKey);
      } else if (MsgType === 'text') {
        return await this.handleTextMessage(openid, ToUserName, FromUserName, Content);
      }

      return wechatService.generateTextReply(ToUserName, FromUserName, '欢迎使用主动番茄！');
    } catch (error) {
      console.error('[handleMessage] 错误:', error.message, error.stack);
      return wechatService.generateTextReply(ToUserName, FromUserName, '抱歉，系统出错了，请稍后再试。');
    }
  }

  async handleEvent(openid, toUser, fromUser, event, eventKey) {
    switch (event) {
      case 'subscribe':
        return await this.handleSubscribe(openid, toUser, fromUser);
      case 'unsubscribe':
        return await this.handleUnsubscribe(openid);
      case 'CLICK':
        return await this.handleMenuClick(openid, toUser, fromUser, eventKey);
      default:
        return wechatService.generateTextReply(toUser, fromUser, '欢迎使用主动番茄！');
    }
  }

  async handleSubscribe(openid, toUser, fromUser) {
    await userService.updateUserSubscription(openid, true);
    const reply = `欢迎关注主动番茄！🍅

这是一个主动式番茄钟，帮助你改善拖延，主动把握时间。

使用指南：
• 点击底部菜单「开始活动」开始计时
• 发送「今日记录」查看今天的时间线
• 发送「添加活动 xxx」添加今日活动

开始你的第一个番茄吧！`;
    return wechatService.generateTextReply(toUser, fromUser, reply);
  }

  async handleUnsubscribe(openid) {
    await userService.updateUserSubscription(openid, false);
    return '';
  }

  async handleMenuClick(openid, toUser, fromUser, eventKey) {
    switch (eventKey) {
      case 'START_ACTIVITY':
        return await this.startActivityFlow(openid, toUser, fromUser);
      case 'END_ACTIVITY':
        return await this.endActivityFlow(openid, toUser, fromUser);
      case 'TODAY_RECORD':
        return await this.showTodayRecord(openid, toUser, fromUser);
      default:
        return wechatService.generateTextReply(toUser, fromUser, '收到！');
    }
  }

  async handleTextMessage(openid, toUser, fromUser, content) {
    const trimmedContent = content.trim();
    const session = await sessionService.getSession(openid);

    if (trimmedContent === '开始' || trimmedContent === '新活动') {
      return await this.startActivityFlow(openid, toUser, fromUser);
    } else if (trimmedContent === '结束') {
      return await this.endActivityFlow(openid, toUser, fromUser);
    } else if (trimmedContent === '今日记录') {
      return await this.showTodayRecord(openid, toUser, fromUser);
    } else if (trimmedContent.startsWith('添加活动 ')) {
      const activityName = trimmedContent.slice(5).trim();
      return await this.addActivityToPool(openid, toUser, fromUser, activityName);
    } else if (trimmedContent.startsWith('删除活动 ')) {
      const activityName = trimmedContent.slice(5).trim();
      return await this.removeActivityFromPool(openid, toUser, fromUser, activityName);
    }

    switch (session.step) {
      case 'selecting_activity':
        return await this.handleActivityNameInput(openid, toUser, fromUser, trimmedContent);
      case 'setting_duration':
        return await this.handleDurationInput(openid, toUser, fromUser, trimmedContent);
      case 'confirming_early_end':
        return await this.handleEarlyEndConfirm(openid, toUser, fromUser, trimmedContent);
      default:
        return wechatService.generateTextReply(toUser, fromUser, 
          '发送「开始」开始新活动，或「今日记录」查看记录～');
    }
  }

  async startActivityFlow(openid, toUser, fromUser) {
    const ongoing = await activityService.getOngoingActivity(openid);
    if (ongoing) {
      const elapsed = Math.round((new Date() - ongoing.startTime) / (1000 * 60));
      return wechatService.generateTextReply(toUser, fromUser, 
        `当前正在进行【${ongoing.name}】，已进行 ${elapsed} 分钟。\n\n发送「结束」结束当前活动。`);
    }

    const pool = await activityPoolService.getTodayPool(openid);
    await sessionService.updateSession(openid, { step: 'selecting_activity' });

    let reply = '请选择或输入活动名称：\n\n';
    if (pool.activities.length > 0) {
      reply += pool.activities.map((a, i) => `${i + 1}. ${a}`).join('\n');
      reply += '\n\n';
    }
    reply += '直接回复活动名称即可开始～';

    return wechatService.generateTextReply(toUser, fromUser, reply);
  }

  async handleActivityNameInput(openid, toUser, fromUser, activityName) {
    if (!activityName) {
      return wechatService.generateTextReply(toUser, fromUser, '请输入活动名称～');
    }

    await sessionService.updateSession(openid, {
      step: 'setting_duration',
      tempActivityName: activityName
    });

    return wechatService.generateTextReply(toUser, fromUser, 
      `你选择了【${activityName}】\n\n请设定时长（分钟）：\n• 25（番茄钟）\n• 40（专注）\n• 直接输入数字`);
  }

  async handleDurationInput(openid, toUser, fromUser, durationStr) {
    const duration = parseInt(durationStr);
    if (isNaN(duration) || duration <= 0) {
      return wechatService.generateTextReply(toUser, fromUser, '请输入有效的时长（数字）～');
    }

    const session = await sessionService.getSession(openid);
    const activity = await activityService.startActivity(
      openid, 
      session.tempActivityName, 
      duration
    );

    await sessionService.resetSession(openid);

    return wechatService.generateTextReply(toUser, fromUser, 
      `开始【${activity.name}】，时长${duration}分钟。\n\n放下手机，专注当下～ 🎯`);
  }

  async endActivityFlow(openid, toUser, fromUser) {
    const activity = await activityService.getOngoingActivity(openid);
    if (!activity) {
      return wechatService.generateTextReply(toUser, fromUser, '当前没有进行中的活动～');
    }

    const now = new Date();
    const plannedEndTime = new Date(activity.startTime.getTime() + activity.plannedDuration * 60 * 1000);

    if (now < plannedEndTime) {
      await sessionService.updateSession(openid, { step: 'confirming_early_end' });
      return wechatService.generateTextReply(toUser, fromUser, 
        `确定要提前结束【${activity.name}】吗？\n\n你将获得一颗半熟番茄🍅\n\n回复「确定」结束，或「继续」继续进行。`);
    } else {
      return await this.completeActivity(openid, toUser, fromUser, false);
    }
  }

  async handleEarlyEndConfirm(openid, toUser, fromUser, content) {
    if (content === '确定') {
      return await this.completeActivity(openid, toUser, fromUser, true);
    } else if (content === '继续') {
      await sessionService.resetSession(openid);
      const activity = await activityService.getOngoingActivity(openid);
      return wechatService.generateTextReply(toUser, fromUser, 
        `好的，继续【${activity.name}】！💪`);
    } else {
      return wechatService.generateTextReply(toUser, fromUser, 
        '请回复「确定」结束活动，或「继续」继续进行～');
    }
  }

  async completeActivity(openid, toUser, fromUser, isEarlyEnd) {
    const activity = await activityService.endActivity(openid, isEarlyEnd);
    await sessionService.resetSession(openid);

    const tomatoEmoji = activity.tomatoType === 'perfect' ? '🍅' : '🍳';
    const tomatoText = activity.tomatoType === 'perfect' ? '完美番茄' : '半熟番茄';

    return wechatService.generateTextReply(toUser, fromUser, 
      `【${activity.name}】已完成！\n\n计划时长：${activity.plannedDuration}分钟\n实际用时：${activity.actualDuration}分钟\n\n获得 ${tomatoEmoji} ${tomatoText}\n\n继续下一个活动吗？发送「开始」即可～`);
  }

  async addActivityToPool(openid, toUser, fromUser, activityName) {
    if (!activityName) {
      return wechatService.generateTextReply(toUser, fromUser, '请输入活动名称，格式：添加活动 xxx');
    }

    await activityPoolService.addActivity(openid, activityName);
    const pool = await activityPoolService.getTodayPool(openid);

    return wechatService.generateTextReply(toUser, fromUser, 
      `已添加【${activityName}】到今日活动池！\n\n当前活动池：\n${pool.activities.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
  }

  async removeActivityFromPool(openid, toUser, fromUser, activityName) {
    await activityPoolService.removeActivity(openid, activityName);
    const pool = await activityPoolService.getTodayPool(openid);

    return wechatService.generateTextReply(toUser, fromUser, 
      `已从今日活动池移除【${activityName}】\n\n当前活动池：\n${pool.activities.map((a, i) => `${i + 1}. ${a}`).join('\n') || '（空）'}`);
  }

  async showTodayRecord(openid, toUser, fromUser) {
    const activities = await activityService.getTodayActivities(openid);
    
    if (activities.length === 0) {
      return wechatService.generateTextReply(toUser, fromUser, '今天还没有活动记录～\n\n发送「开始」开始第一个活动吧！');
    }

    let reply = '📅 今日时间线\n\n';
    let perfectCount = 0;
    let halfRipeCount = 0;
    let totalMinutes = 0;

    activities.slice().reverse().forEach(activity => {
      const startTime = activity.startTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const tomatoEmoji = activity.tomatoType === 'perfect' ? '🍅' : (activity.tomatoType === 'half-ripe' ? '🍳' : '');
      if (activity.tomatoType === 'perfect') perfectCount++;
      if (activity.tomatoType === 'half-ripe') halfRipeCount++;
      if (activity.actualDuration) totalMinutes += activity.actualDuration;

      reply += `${startTime} 【${activity.name}】`;
      if (activity.actualDuration) {
        reply += ` ${activity.actualDuration}分钟 ${tomatoEmoji}`;
      } else if (activity.status === 'ongoing') {
        reply += ' 进行中...';
      }
      reply += '\n';
    });

    reply += `\n📊 今日统计\n`;
    reply += `总专注时长：${formatDuration(totalMinutes)}\n`;
    reply += `完美番茄：${perfectCount} 个\n`;
    reply += `半熟番茄：${halfRipeCount} 个`;

    return wechatService.generateTextReply(toUser, fromUser, reply);
  }
}

module.exports = new MessageHandler();
