const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 静态文件（H5 倒计时页）
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/timer', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'timer.html'));
});

// 首页
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: '主动番茄', time: new Date().toISOString() });
});

// 微信模块
const bodyParser = require('body-parser');
const wechatController = require('./controllers/wechatController');

app.get('/wechat', (req, res) => wechatController.verify(req, res));
app.post('/wechat', bodyParser.text({ type: ['text/xml', 'text/plain'], limit: '1mb' }),
  (req, res) => wechatController.handleMessage(req, res)
);

app.listen(PORT, '0.0.0.0', () => {
  console.log('主动番茄 MVP 已启动, port:', PORT);
});
