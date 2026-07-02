require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { connectDB } = require('./config/database');
const wechatController = require('./controllers/wechatController');
const reminderService = require('./services/reminderService');
const wechatService = require('./services/wechatService');
const activityService = require('./services/activityService');

const app = express();
const PORT = process.env.PORT || 3000;

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} CT=${req.get('Content-Type') || '-'}`);
  next();
});

// 静态文件 - H5 页面
app.use(express.static(path.join(__dirname, '..', 'public')));

// H5 倒计时页面
app.get('/timer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'timer.html'));
});

// --- API ---

// 获取当前活动状态（供 H5 倒计时页使用）
app.get('/api/timer/status', async (req, res) => {
  try {
    const PREVIEW_OPENID = 'preview_user_001';
    const ongoing = await activityService.getOngoingActivity(PREVIEW_OPENID);
    
    if (ongoing) {
      res.json({
        ongoing: true,
        name: ongoing.name,
        plannedDuration: ongoing.plannedDuration,
        startTime: ongoing.startTime.toISOString(),
        elapsed: Math.round((Date.now() - ongoing.startTime) / (1000 * 60))
      });
    } else {
      res.json({ ongoing: false });
    }
  } catch (e) {
    res.json({ ongoing: false });
  }
});

// --- 微信 ---

// GET 请求处理（微信服务器验证）
app.get('/wechat', (req, res) => {
  try {
    wechatController.verify(req, res);
  } catch (e) {
    console.error('微信验证出错:', e.message);
    res.status(500).send('error');
  }
});

// POST 请求处理 - 微信消息（只用 text/plain 和 text/xml）
app.post('/wechat', bodyParser.text({ type: ['text/xml', 'text/plain'], limit: '1mb' }), (req, res) => {
  try {
    const xmlData = req.body || '';
    console.log('收到微信消息，长度:', xmlData.length, 'CT:', req.get('Content-Type'));
    if (xmlData.length > 0) {
      console.log('内容(前200字):', xmlData.substring(0, 200));
    } else {
      console.log('警告: 请求体为空！');
    }
    wechatController.handleMessage(req, res);
  } catch (e) {
    console.error('微信消息处理出错:', e.message);
    res.send('success');
  }
});

// --- 首页 ---
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>主动番茄</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f7f7f7;margin:0}.card{text-align:center;background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08)}h1{color:#07c160;margin:0 0 8px}p{color:#666;margin:0}</style></head><body><div class="card"><h1>🍅 主动番茄</h1><p>微信公众号服务正在运行...</p></div></body></html>`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 全局错误处理，防止进程崩溃
process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

// --- 启动 ---
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`服务器运行在 0.0.0.0:${PORT}`);
    });

    reminderService.start();

    // 菜单：活动 | 开始/结束 | 倒计时（子菜单含倒计时+记录）
    const baseUrl = process.env.SITE_URL || 'https://tomato-wechat-production.up.railway.app';
    const menuConfig = {
      button: [
        { name: '活动', type: 'click', key: 'START_ACTIVITY' },
        { name: '开始/结束', type: 'click', key: 'END_ACTIVITY' },
        {
          name: '更多',
          sub_button: [
            { name: '⏱ 倒计时', type: 'view', url: `${baseUrl}/timer` },
            { name: '📋 今日记录', type: 'click', key: 'TODAY_RECORD' }
          ]
        }
      ]
    };

    try {
      const result = await wechatService.createMenu(menuConfig);
      console.log('微信菜单创建成功:', JSON.stringify(result));
    } catch (error) {
      console.log('微信菜单创建失败:', error.message);
    }

  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();
