const crypto = require('crypto');
const wechatConfig = require('../config/wechat');
const messageHandler = require('../services/messageHandler');

function parseXML(xml) {
  const result = {};
  const re = /<(\w+)>(?:<!\[CDATA\[)?([^\]]*?)(?:\]\]>)?<\/\1>/g;
  let m;
  while ((m = re.exec(xml)) !== null) result[m[1]] = m[2];
  return result;
}

class WechatController {
  verify(req, res) {
    const { signature, timestamp, nonce, echostr } = req.query;
    const token = wechatConfig.token;

    console.log('验证请求 - token:', token ? '已设置' : '未设置');

    if (!token) {
      return res.type('text/plain').send('');
    }

    const hash = crypto.createHash('sha1')
      .update([token, timestamp, nonce].sort().join(''), 'utf-8')
      .digest('hex');

    console.log('hash:', hash, 'sig:', signature, 'match:', hash === signature);

    if (hash === signature) {
      res.type('text/plain').send(echostr);
    } else {
      res.type('text/plain').send('');
    }
  }

  async handleMessage(req, res) {
    try {
      const xml = req.body;
      if (!xml) return res.send('');
      const msg = parseXML(xml);
      console.log('收到消息:', JSON.stringify(msg));
      const reply = await messageHandler.handle(msg);
      res.set('Content-Type', 'application/xml').send(reply);
    } catch (e) {
      console.error('消息处理异常:', e.message);
      res.send('success');
    }
  }
}

module.exports = new WechatController();
