const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();

// ========== 调试端点（查看环境变量状态） ==========
app.get('/debug', (req, res) => {
  const token = process.env.WECHAT_TOKEN;
  res.json({
    WECHAT_TOKEN: token || '(未设置)',
    tokenLength: token ? token.length : 0,
    tokenBytes: token ? Buffer.from(token).toString('hex') : '',
    WECHAT_APPID: process.env.WECHAT_APPID ? '已设置' : '未设置',
    WECHAT_APPSECRET: process.env.WECHAT_APPSECRET ? '已设置' : '未设置',
    SITE_URL: process.env.SITE_URL || '未设置',
    PORT: process.env.PORT,
    time: new Date().toISOString()
  });
});

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

  console.log('===== 微信验证 =====');
  console.log('token:', JSON.stringify(token));
  console.log('timestamp:', timestamp);
  console.log('nonce:', nonce);
  console.log('signature:', signature);
  console.log('echostr:', echostr ? echostr.substring(0, 20) : '(无)');

  if (!token) {
    console.log('结果: TOKEN 未设置!');
    return res.send('');
  }

  const arr = [token, timestamp, nonce].sort();
  const str = arr.join('');
  const hash = crypto.createHash('sha1').update(str, 'utf-8').digest('hex');

  console.log('排序:', arr);
  console.log('拼接:', str);
  console.log('本地:', hash);
  console.log('微信:', signature);
  console.log('匹配:', hash === signature);

  if (hash === signature) {
    console.log('结果: 验证成功!');
    res.send(echostr);
  } else {
    console.log('结果: 验证失败!');
    res.send('');
  }
});

// ========== 微信消息 ==========
const bodyParser = require('body-parser');
const messageHandler = require('./services/messageHandler');

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
      console.log('消息:', JSON.stringify(msg));
      const reply = await messageHandler.handle(msg);
      res.set('Content-Type', 'application/xml').send(reply);
    } catch (e) {
      console.error('消息错误:', e.message);
      res.send('success');
    }
  }
);

// ========== 启动 ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('=== 主动番茄已启动 ===');
  console.log('PORT:', PORT);
  console.log('WECHAT_TOKEN:', process.env.WECHAT_TOKEN ? '已设置 (' + process.env.WECHAT_TOKEN.length + '字符)' : '未设置');
  console.log('SITE_URL:', process.env.SITE_URL || '未设置');
});
