const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();

// ========== 静态文件 ==========
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/timer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'timer.html'));
});

// ========== 首页 ==========
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: '主动番茄', time: new Date().toISOString() });
});

// ========== 微信验证 ==========
app.get('/wechat', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;
  const token = process.env.WECHAT_TOKEN;

  if (!token) {
    console.error('WECHAT_TOKEN 未设置');
    return res.send('');
  }

  const hash = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join(''), 'utf-8').digest('hex');

  if (hash === signature) {
    res.send(echostr);
  } else {
    console.error('微信验证失败');
    res.send('');
  }
});

// ========== 微信消息 ==========
const bodyParser = require('body-parser');
const messageHandler = require('./services/messageHandler');
const activityService = require('./services/activityService');
const axios = require('axios');

app.use(express.json()); // 解析 JSON body

function parseXML(xml) {
  const result = {};
  const re = /<(\w+)>(?:<!\[CDATA\[)?([^\]]*?)(?:\]\]>)?<\/\1>/g;
  let m;
  while ((m = re.exec(xml)) !== null) result[m[1]] = m[2];
  return result;
}

app.post('/wechat', bodyParser.text({ type: ['text/xml', 'text/plain'], limit: '1mb' }),
  async (req, res) => {
    try {
      const xml = req.body || '';
      if (!xml) return res.send('');
      const msg = parseXML(xml);
      const reply = await messageHandler.handle(msg);
      res.set('Content-Type', 'application/xml').send(reply);
    } catch (e) {
      console.error('消息错误:', e.message);
      res.send('success');
    }
  }
);

// ========== H5 活动记录 API ==========
// 开始活动（H5 页面调用）
app.post('/api/activity/start', (req, res) => {
  const { openid, name, duration } = req.body;
  if (!openid || !name || !duration) {
    return res.status(400).json({ ok: false, error: '缺少参数 openid/name/duration' });
  }
  const existing = activityService.getOngoing(openid);
  if (existing) {
    return res.json({ ok: true, activity: existing, note: '已有进行中的活动' });
  }
  const activity = activityService.start(openid, name, duration);
  // H5 启动时也调度微信提醒
  messageHandler.scheduleReminder(openid, name, duration);
  console.log('H5 开始活动:', openid, name, duration);
  res.json({ ok: true, activity });
});

// 结束活动（H5 页面调用）
app.post('/api/activity/end', (req, res) => {
  const { openid } = req.body;
  if (!openid) {
    return res.status(400).json({ ok: false, error: '缺少 openid' });
  }
  // 取消服务端提醒
  messageHandler.cancelReminder(openid);
  const activity = activityService.end(openid);
  if (!activity) {
    return res.json({ ok: false, error: '没有进行中的活动' });
  }
  const actual = Math.round((activity.endTime - activity.startTime) / 60000);
  const done = actual >= activity.plannedDuration;
  const icon = done ? '🍅' : '🍳';
  const label = done ? '完美番茄' : '半熟番茄';
  const note = done ? '' : `\n（未达计划时长，下次加油！）`;

  console.log('H5 结束活动:', openid, activity.name, actual, '分钟');

  // 发送微信消息到聊天框（与 cmdEnd 格式一致）
  messageHandler.sendCustomerMsg(openid,
    '✅ 完成！\n' +
    '━━━━━━━━━━━\n' +
    `📌 活动：${activity.name}\n` +
    `⏰ 计划：${activity.plannedDuration} 分钟\n` +
    `⏱ 实际：${actual} 分钟\n` +
    `${icon}  ${label}${note}\n\n` +
    '干得漂亮！发送「开始」继续～'
  );

  res.json({ ok: true, activity: { ...activity, actualMinutes: actual } });
});

// 获取今日记录（H5 页面调用）
app.get('/api/activities/:openid', (req, res) => {
  const { openid } = req.params;
  const list = activityService.getTodayActivities(openid);
  const result = list.map(a => ({
    name: a.name,
    plannedDuration: a.plannedDuration,
    actualMinutes: Math.round(((a.endTime || Date.now()) - a.startTime) / 60000),
    completed: a.status === 'completed',
    time: new Date(a.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }));
  res.json({ ok: true, activities: result, total: result.length });
});

// 查询当前进行中活动（H5 页面初始化用）
app.get('/api/ongoing/:openid', (req, res) => {
  const { openid } = req.params;
  const ongoing = activityService.getOngoing(openid);
  res.json({ ok: true, ongoing: ongoing || null });
});

// ========== 时钟直达（微信 OAuth 静默授权） ==========
app.get('/clock', (req, res) => {
  const { openid } = req.query;
  const siteUrl = process.env.SITE_URL || '';

  if (openid) {
    // 已有 openid，检查进行中活动 → 直接跳转计时器
    const ongoing = activityService.getOngoing(openid);
    if (ongoing) {
      return res.redirect(`${siteUrl}/timer?name=${encodeURIComponent(ongoing.name)}&duration=${ongoing.plannedDuration}&startTime=${ongoing.startTime}&openid=${openid}`);
    }
    // 无进行中活动，统一跳转到计时器页面（显示设置表单）
    return res.redirect(`${siteUrl}/timer?openid=${openid}`);
  }

  // 无 openid → 发起 OAuth 静默授权
  const redirectUri = encodeURIComponent(`${siteUrl}/clock/callback`);
  const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${process.env.WECHAT_APPID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=clock#wechat_redirect`;
  res.redirect(authUrl);
});

// OAuth 回调：换取 openid 后重定向回 /clock
app.get('/clock/callback', async (req, res) => {
  const { code } = req.query;
  const siteUrl = process.env.SITE_URL || '';
  if (!code) return res.send('授权失败');

  try {
    const { data } = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_APPSECRET,
        code,
        grant_type: 'authorization_code'
      }
    });
    res.redirect(`${siteUrl}/clock?openid=${data.openid}`);
  } catch (e) {
    console.error('OAuth回调失败:', e.response?.data || e.message);
    res.send('授权失败，请重试');
  }
});

// ========== 微信菜单创建 ==========

async function getAccessToken() {
  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid: process.env.WECHAT_APPID,
      secret: process.env.WECHAT_APPSECRET
    }
  });
  return data.access_token;
}

async function createMenu() {
  try {
    if (!process.env.WECHAT_APPID || !process.env.WECHAT_APPSECRET) {
      return console.log('菜单: APPID/APPSECRET 未设置，跳过');
    }
    const token = await getAccessToken();
    const menu = {
      button: [
        {
          name: '🍅 开始',
          sub_button: [
            { type: 'click', name: '📖 阅读 25分钟', key: 'QUICK_READ' },
            { type: 'click', name: '📚 学习 25分钟', key: 'QUICK_STUDY' },
            { type: 'click', name: '🏃 运动 25分钟', key: 'QUICK_SPORT' },
            { type: 'click', name: '💼 工作 25分钟', key: 'QUICK_WORK' },
            { type: 'click', name: '✏️ 自定义...', key: 'MENU_CUSTOM' }
          ]
        },
        {
          name: '⏹ 结束',
          type: 'click',
          key: 'MENU_END'
        },
        {
          name: '📊 更多',
          sub_button: [
            { type: 'click', name: '📋 今日记录', key: 'MENU_RECORD' },
            { type: 'view', name: '🕐 时钟', url: `${process.env.SITE_URL}/clock` }
          ]
        }
      ]
    };
    await axios.post(
      `https://api.weixin.qq.com/cgi-bin/menu/create?access_token=${token}`,
      menu
    );
    console.log('微信菜单创建成功');
  } catch (e) {
    console.error('菜单创建失败:', e.response?.data?.errmsg || e.message);
  }
}

// ========== 启动 ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
  console.log('=== 主动番茄已启动 ===');
  console.log('PORT:', PORT);
  console.log('WECHAT_TOKEN:', process.env.WECHAT_TOKEN ? '已设置 (' + process.env.WECHAT_TOKEN.length + '字符)' : '未设置');
  console.log('SITE_URL:', process.env.SITE_URL || '未设置');
  await createMenu();
});
