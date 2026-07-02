const sessionService = require('./sessionService');
const activityService = require('./activityService');

function textReply(toUser, fromAccount, content) {
  const ts = Math.floor(Date.now() / 1000);
  return `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName><FromUserName><![CDATA[${fromAccount}]]></FromUserName><CreateTime>${ts}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${content}]]></Content></xml>`;
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

class MessageHandler {
  async handle(msg) {
    const { ToUserName, FromUserName, MsgType, Content, Event, EventKey } = msg;
    const openid = FromUserName;
    const accountId = ToUserName;

    try {
      // 菜单点击事件
      if (MsgType === 'event' && Event === 'CLICK') {
        return await this.handleClick(openid, accountId, EventKey);
      }
      // 关注事件
      if (MsgType === 'event') {
        return this.welcome(openid, accountId);
      }
      // 文本消息
      if (MsgType === 'text') {
        return await this.handleText(openid, accountId, Content.trim());
      }
      return this.welcome(openid, accountId);
    } catch (e) {
      console.error('消息处理异常:', e.message);
      return textReply(openid, accountId, '出错了，请稍后重试');
    }
  }

  // ========== 菜单点击处理 ==========
  async handleClick(openid, accountId, key) {
    switch (key) {
      case 'QUICK_READ':   return this.quickStart(openid, accountId, '阅读', 25);
      case 'QUICK_STUDY':  return this.quickStart(openid, accountId, '学习', 25);
      case 'QUICK_SPORT':  return this.quickStart(openid, accountId, '运动', 25);
      case 'QUICK_WORK':   return this.quickStart(openid, accountId, '工作', 25);
      case 'MENU_CUSTOM':  return this.cmdStart(openid, accountId);
      case 'MENU_END':     return this.cmdEnd(openid, accountId);
      case 'MENU_RECORD':  return this.showRecord(openid, accountId);
      case 'MENU_HELP':    return this.welcome(openid, accountId);
      default:             return this.welcome(openid, accountId);
    }
  }

  // ========== 快速开始（菜单直达，跳过交互） ==========
  async quickStart(openid, accountId, name, dur) {
    const ongoing = activityService.getOngoing(openid);
    if (ongoing) {
      const min = Math.round((Date.now() - ongoing.startTime) / 60000);
      return textReply(openid, accountId,
        '⏳ 正在专注中\n' +
        '━━━━━━━━━━━\n' +
        `📌 ${ongoing.name}\n` +
        `⏱ 已进行 ${min} 分钟\n\n` +
        '专注完成后再回复「结束」'
      );
    }
    const activity = activityService.start(openid, name, dur);
    const base = process.env.SITE_URL || 'http://localhost:3000';
    const link = `${base}/timer?name=${encodeURIComponent(name)}&duration=${dur}`;

    return textReply(openid, accountId,
      '🍅 快速番茄已开始！\n' +
      '━━━━━━━━━━━\n' +
      `📌 活动：${activity.name}\n` +
      `⏰ 时长：${dur} 分钟\n` +
      `🕐 开始：${nowTime()}\n\n` +
      `📱 点击查看倒计时：\n${link}\n\n` +
      '放下手机，专注当下 🎯\n' +
      '完成后回复「结束」'
    );
  }

  // ========== 今日记录 ==========
  showRecord(openid, accountId) {
    return textReply(openid, accountId,
      '📊 今日记录\n' +
      '━━━━━━━━━━━\n' +
      '功能开发中，敬请期待～\n\n' +
      '发送「开始」开启番茄钟 🍅'
    );
  }

  // ========== 欢迎 ==========
  welcome(openid, accountId) {
    return textReply(openid, accountId,
      '🍅 主动番茄\n' +
      '━━━━━━━━━━━\n' +
      '专注当下，高效工作\n\n' +
      '👉 点击底部菜单快速开始\n' +
      '👉 发送「开始」自定义活动\n' +
      '👉 发送「结束」完成当前活动'
    );
  }

  // ========== 文本消息路由 ==========
  async handleText(openid, accountId, content) {
    const session = await sessionService.get(openid);

    if (content === '开始' || content === '新活动') return this.cmdStart(openid, accountId);
    if (content === '结束') return this.cmdEnd(openid, accountId);

    switch (session.step) {
      case 'selecting_activity': return this.stepActivity(openid, accountId, content);
      case 'setting_duration':   return this.stepDuration(openid, accountId, content);
      default: return this.welcome(openid, accountId);
    }
  }

  async cmdStart(openid, accountId) {
    const ongoing = activityService.getOngoing(openid);
    if (ongoing) {
      const min = Math.round((Date.now() - ongoing.startTime) / 60000);
      return textReply(openid, accountId,
        '⏳ 正在专注中\n' +
        '━━━━━━━━━━━\n' +
        `📌 ${ongoing.name}\n` +
        `⏱ 已进行 ${min} 分钟\n\n` +
        '专注完成后再回复「结束」'
      );
    }
    await sessionService.update(openid, { step: 'selecting_activity' });
    return textReply(openid, accountId,
      '🎯 你想做什么？\n' +
      '━━━━━━━━━━━\n' +
      '直接回复活动名称，例如：\n\n' +
      '📖 阅读\n📚 学习\n🏃 运动\n💼 工作\n\n' +
      '或输入任意其他活动～'
    );
  }

  async stepActivity(openid, accountId, name) {
    await sessionService.update(openid, { step: 'setting_duration', tempActivityName: name });
    return textReply(openid, accountId,
      '⏱ 设定时长\n' +
      '━━━━━━━━━━━\n' +
      `你选择了「${name}」\n\n` +
      '直接回复分钟数：\n\n' +
      '🍅 25 分钟（经典番茄）\n' +
      '⚡ 40 分钟（深度专注）\n' +
      '💪 60 分钟（挑战模式）\n\n' +
      '或输入任意 1-180 的数字'
    );
  }

  async stepDuration(openid, accountId, input) {
    const dur = parseInt(input);
    if (isNaN(dur) || dur < 1 || dur > 180) {
      return textReply(openid, accountId, '请输入 1-180 之间的数字');
    }

    const session = await sessionService.get(openid);
    const activity = activityService.start(openid, session.tempActivityName, dur);
    await sessionService.update(openid, { step: 'idle' });

    const base = process.env.SITE_URL || 'http://localhost:3000';
    const link = `${base}/timer?name=${encodeURIComponent(activity.name)}&duration=${dur}`;

    return textReply(openid, accountId,
      '🍅 番茄钟已开始！\n' +
      '━━━━━━━━━━━\n' +
      `📌 活动：${activity.name}\n` +
      `⏰ 时长：${dur} 分钟\n` +
      `🕐 开始：${nowTime()}\n\n` +
      `📱 点击查看倒计时：\n${link}\n\n` +
      '放下手机，专注当下 🎯\n' +
      '完成后回复「结束」'
    );
  }

  async cmdEnd(openid, accountId) {
    const activity = activityService.end(openid);
    if (!activity) {
      return textReply(openid, accountId,
        '📭 没有进行中的活动\n' +
        '━━━━━━━━━━━\n' +
        '发送「开始」开启一个番茄钟 🍅'
      );
    }
    const actual = Math.round((activity.endTime - activity.startTime) / 60000);
    const done = actual >= activity.plannedDuration;
    const icon = done ? '🍅' : '🍳';
    const label = done ? '完美番茄' : '半熟番茄';

    return textReply(openid, accountId,
      '✅ 完成！\n' +
      '━━━━━━━━━━━\n' +
      `📌 活动：${activity.name}\n` +
      `⏰ 计划：${activity.plannedDuration} 分钟\n` +
      `⏱ 实际：${actual} 分钟\n` +
      `${icon}  ${label}\n\n` +
      '干得漂亮！发送「开始」继续～'
    );
  }
}

module.exports = new MessageHandler();
