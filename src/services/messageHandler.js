const axios = require('axios');
const sessionService = require('./sessionService');
const activityService = require('./activityService');

// 存储定时提醒的 timeout
const reminders = new Map();

function textReply(toUser, fromAccount, content) {
  const ts = Math.floor(Date.now() / 1000);
  return `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName><FromUserName><![CDATA[${fromAccount}]]></FromUserName><CreateTime>${ts}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${content}]]></Content></xml>`;
}

function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// 客服消息 API（主动推送提醒）
async function sendCustomerMsg(openid, text) {
  try {
    const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_APPSECRET
      }
    });
    await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${data.access_token}`,
      { touser: openid, msgtype: 'text', text: { content: text } }
    );
    console.log('提醒已发送:', openid);
  } catch (e) {
    console.error('发送提醒失败:', e.response?.data || e.message);
  }
}

// 调度时间到提醒
function scheduleReminder(openid, name, durationMin) {
  // 清除旧提醒
  cancelReminder(openid);
  // 新提醒
  const ms = durationMin * 60 * 1000;
  const id = setTimeout(() => {
    const ongoing = activityService.getOngoing(openid);
    if (ongoing && ongoing.name === name) {
      sendCustomerMsg(openid,
        '⏰ 时间到！\n' +
        '━━━━━━━━━━━\n' +
        `📌 ${name} ${durationMin} 分钟已完成\n\n` +
        '回复「结束」记录实际时长 🍅'
      );
    }
    reminders.delete(openid);
  }, ms);
  reminders.set(openid, id);
}

function cancelReminder(openid) {
  if (reminders.has(openid)) {
    clearTimeout(reminders.get(openid));
    reminders.delete(openid);
  }
}

class MessageHandler {
  async handle(msg) {
    const { ToUserName, FromUserName, MsgType, Content, Event, EventKey } = msg;
    const openid = FromUserName;
    const accountId = ToUserName;

    try {
      if (MsgType === 'event' && Event === 'CLICK') {
        return await this.handleClick(openid, accountId, EventKey);
      }
      if (MsgType === 'event') {
        return this.welcome(openid, accountId);
      }
      if (MsgType === 'text') {
        return await this.handleText(openid, accountId, Content.trim());
      }
      return this.welcome(openid, accountId);
    } catch (e) {
      console.error('消息处理异常:', e.message);
      return textReply(openid, accountId, '出错了，请稍后重试');
    }
  }

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

  async quickStart(openid, accountId, name, dur) {
    const ongoing = activityService.getOngoing(openid);
    if (ongoing) {
      const min = Math.round((Date.now() - ongoing.startTime) / 60000);
      return textReply(openid, accountId,
        '⏳ 正在专注中\n' +
        '━━━━━━━━━━━\n' +
        `📌 ${ongoing.name}\n` +
        `⏱ 已进行 ${min} 分钟\n\n` +
        '完成后回复「结束」记录时长'
      );
    }
    const activity = activityService.start(openid, name, dur);
    const base = process.env.SITE_URL || 'http://localhost:3000';
    const link = `${base}/timer?name=${encodeURIComponent(name)}&duration=${dur}&openid=${openid}`;

    // 调度到时间提醒
    scheduleReminder(openid, name, dur);

    return textReply(openid, accountId,
      '🍅 快速番茄已开始！\n' +
      '━━━━━━━━━━━\n' +
      `📌 活动：${activity.name}\n` +
      `⏰ 时长：${dur} 分钟\n` +
      `🕐 开始：${nowTime()}\n\n` +
      `📱 点击查看倒计时：\n${link}\n\n` +
      '放下手机，专注当下 🎯\n' +
      '完成后回复「结束」记录实际时长'
    );
  }

  showRecord(openid, accountId) {
    const list = activityService.getTodayActivities(openid);
    if (list.length === 0) {
      return textReply(openid, accountId,
        '📊 今日记录\n' +
        '━━━━━━━━━━━\n' +
        '今天还没有完成记录\n\n' +
        '发送「开始」开启番茄钟 🍅'
      );
    }
    let totalMin = 0;
    let msg = '📊 今日记录\n' + '━━━━━━━━━━━\n';
    list.forEach(a => {
      const actual = Math.round(((a.endTime || Date.now()) - a.startTime) / 60000);
      totalMin += actual;
      const done = actual >= a.plannedDuration;
      msg += `${done ? '🍅' : '🍳'} ${a.name} — ${actual} 分钟\n`;
    });
    msg += '━━━━━━━━━━━\n' +
      `🎯 共 ${list.length} 次 | ${totalMin} 分钟\n\n` +
      '继续保持！';
    return textReply(openid, accountId, msg);
  }

  welcome(openid, accountId) {
    return textReply(openid, accountId,
      '🍅 主动番茄\n' +
      '━━━━━━━━━━━\n' +
      '专注当下，高效工作\n\n' +
      '👉 点击底部菜单快速开始\n' +
      '👉 发送「开始」自定义活动\n' +
      '👉 完成后回复「结束」记录时长'
    );
  }

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
        '完成后回复「结束」记录时长'
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

    // 调度到时间提醒
    scheduleReminder(openid, session.tempActivityName, dur);

    const base = process.env.SITE_URL || 'http://localhost:3000';
    const link = `${base}/timer?name=${encodeURIComponent(activity.name)}&duration=${dur}&openid=${openid}`;

    return textReply(openid, accountId,
      '🍅 番茄钟已开始！\n' +
      '━━━━━━━━━━━\n' +
      `📌 活动：${activity.name}\n` +
      `⏰ 时长：${dur} 分钟\n` +
      `🕐 开始：${nowTime()}\n\n` +
      `📱 点击查看倒计时：\n${link}\n\n` +
      '放下手机，专注当下 🎯\n' +
      '完成后回复「结束」记录实际时长'
    );
  }

  async cmdEnd(openid, accountId) {
    // 取消提醒
    cancelReminder(openid);

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
    const note = done ? '' : `\n（未达计划时长，下次加油！）`;

    return textReply(openid, accountId,
      '✅ 完成！\n' +
      '━━━━━━━━━━━\n' +
      `📌 活动：${activity.name}\n` +
      `⏰ 计划：${activity.plannedDuration} 分钟\n` +
      `⏱ 实际：${actual} 分钟\n` +
      `${icon}  ${label}${note}\n\n` +
      '干得漂亮！发送「开始」继续～'
    );
  }
}

module.exports = new MessageHandler();
module.exports.cancelReminder = cancelReminder;
