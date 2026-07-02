// 全局错误捕获 - 必须在最顶部
process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err.message, '\n', err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise:', reason);
});

console.log('=== 主动番茄 MVP 启动中 ===');
console.log('cwd:', process.cwd());
console.log('__dirname:', __dirname);
console.log('env PORT:', process.env.PORT);
console.log('env WECHAT_TOKEN:', process.env.WECHAT_TOKEN ? '已设置' : '未设置');
console.log('env SITE_URL:', process.env.SITE_URL || '未设置');

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// H5 倒计时页面
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/timer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'timer.html'));
});

// 首页
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: '主动番茄', time: new Date().toISOString() });
});

// === 微信模块（延迟加载，避免启动崩溃） ===
let wechatController = null;
try {
  wechatController = require('./controllers/wechatController');
  console.log('微信模块加载成功');

  const bodyParser = require('body-parser');
  app.get('/wechat', (req, res) => {
    try { wechatController.verify(req, res); }
    catch (e) { console.error('验证路由错误:', e.message); res.type('text/plain').send(''); }
  });
  app.post('/wechat', bodyParser.text({ type: ['text/xml', 'text/plain'], limit: '1mb' }),
    (req, res) => {
      try { wechatController.handleMessage(req, res); }
      catch (e) { console.error('消息路由错误:', e.message); res.send('success'); }
    }
  );
  console.log('微信路由已注册');
} catch (e) {
  console.error('微信模块加载失败:', e.message, '\n', e.stack);
}

// 启动
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=== 主动番茄 MVP 已启动 ===');
  console.log('监听: 0.0.0.0:' + PORT);
});

server.on('error', (err) => {
  console.error('服务器启动失败:', err.message);
  process.exit(1);
});
