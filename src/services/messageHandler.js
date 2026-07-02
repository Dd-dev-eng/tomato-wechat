const sessionService = require('./sessionService');
const activityService = require('./activityService');

function textReply(to, from, content) {
  const ts = Math.floor(Date.now() / 1000);
  return `<xml>
<ToUserName><![CDATA[${to}]]></ToUserName>
<FromUserName><![CDATA[${from}]]></FromUserName>
<CreateTime>${ts}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

class MessageHandler {
  async handle(msg) {
    const { ToUserName, FromUserName, MsgType, Content } = msg;
    const openid = FromUserName;

    try {
      if (MsgType === 'text') {
        return await this.handleText(openid, ToUserName, FromUserName, Content.trim());
      }
      if (MsgType === 'event') {
        return textReply(ToUserName, FromUserName, '🍅 欢迎使用主动番茄！\n\n发送「开始」开启一个番茄钟');
      }
      return textReply(ToUserName, FromUserName, '发送「开始」开始专注吧');
    } catch (e) {
      console.error('消息处理异常:', e.message);
      return textReply(ToUserName, FromUserName, '出错了，请稍后重试');
    }
  }

  async handleText(openid, to, from, content) {
    const session = await sessionService.get(openid);

    // 全局指令（任何状态下可用）
    if (content === '开始' || content === '新活动') return this.cmdStart(openid, to, from);
    if (content === '结束') return this.cmdEnd(openid, to, from);

    // 状态路由
    switch (session.step) {
      case 'selecting_activity': return this.stepActivity(openid, to, from, content);
      case 'setting_duration':   return this.stepDuration(openid, to, from, content);
      default: return textReply(to, from, '发送「开始」开启一个番茄钟 🍅');
    }
  }

  // --- 指令：开始 ---
  async cmdStart(openid, to, from) {
    const ongoing = activityService.getOngoing(openid);
    if (ongoing) {
      const min = Math.round((Date.now() - ongoing.startTime) / 60000);
      return textReply(to, from, `当前正在进行【${ongoing.name}】，已进行 ${min} 分钟。\n\n发送「结束」完成活动。`);
    }
    await sessionService.update(openid, { step: 'selecting_activity' });
    return textReply(to, from, '你想做什么？直接回复活动名称，例如：\n阅读\n学习\n运动');
  }

  // --- 步骤：输入活动名 ---
  async stepActivity(openid, to, from, name) {
    await sessionService.update(openid, { step: 'setting_duration', tempActivityName: name });
    return textReply(to, from, `你选择了【${name}】\n\n设定时长（分钟），直接回复数字，例如：\n25`);
  }

  // --- 步骤：输入时长 ---
  async stepDuration(openid, to, from, input) {
    const dur = parseInt(input);
    if (isNaN(dur) || dur < 1 || dur > 180) {
      return textReply(to, from, '请输入 1-180 之间的分钟数');
    }

    const session = await sessionService.get(openid);
    const activity = activityService.start(openid, session.tempActivityName, dur);
    await sessionService.update(openid, { step: 'idle' });

    const base = process.env.SITE_URL || 'http://localhost:3000';
    const link = `${base}/timer?name=${encodeURIComponent(activity.name)}&duration=${dur}`;

    return textReply(to, from,
      `开始【${activity.name}】，${dur} 分钟 🎯\n\n📱 点击查看倒计时：\n${link}\n\n完成后回复「结束」`
    );
  }

  // --- 指令：结束 ---
  async cmdEnd(openid, to, from) {
    const activity = activityService.end(openid);
    if (!activity) {
      return textReply(to, from, '当前没有进行中的活动。\n\n发送「开始」开一个');
    }
    const actual = Math.round((activity.endTime - activity.startTime) / 60000);
    const emoji = actual >= activity.plannedDuration ? '🍅' : '🍳';
    return textReply(to, from,
      `【${activity.name}】完成！${emoji}\n\n计划 ${activity.plannedDuration} 分钟\n实际 ${actual} 分钟\n\n发送「开始」继续下一个～`
    );
  }
}

module.exports = new MessageHandler();
