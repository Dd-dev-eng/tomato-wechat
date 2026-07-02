const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const wechatController = require('./controllers/wechatController');

const app = express();
const PORT = process.env.PORT || 3000;

// 请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// H5 倒计时页面
app.use(express.static(path.join(__dirname, '..', 'public')));

// 首页
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: '主动番茄', time: new Date().toISOString() });
});

// 微信服务器验证
app.get('/wechat', (req, res) => wechatController.verify(req, res));

// 微信消息处理
app.post('/wechat', bodyParser.text({ type: ['text/xml', 'text/plain'], limit: '1mb' }),
  (req, res) => wechatController.handleMessage(req, res)
);

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log('主动番茄 MVP 已启动');
  console.log('PORT:', PORT);
  console.log('WECHAT_TOKEN:', process.env.WECHAT_TOKEN ? '已设置' : '未设置');
  console.log('SITE_URL:', process.env.SITE_URL || '(未设置)');
});
