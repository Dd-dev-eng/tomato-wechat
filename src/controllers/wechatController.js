const crypto = require('crypto');
const { getConfig } = require('../config/wechat');
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
    const token = getConfig().token;

    console.log('verify - token:', token ? 'set' : 'MISSING');

    if (!token) return res.type('text/plain').send('');

    const hash = crypto.createHash('sha1')
      .update([token, timestamp, nonce].sort().join(''), 'utf-8')
      .digest('hex');

    console.log('verify - match:', hash === signature);
    res.type('text/plain').send(hash === signature ? echostr : '');
  }

  async handleMessage(req, res) {
    try {
      const xml = req.body || '';
      if (!xml) return res.send('');
      const msg = parseXML(xml);
      console.log('msg:', JSON.stringify(msg));
      const reply = await messageHandler.handle(msg);
      res.set('Content-Type', 'application/xml').send(reply);
    } catch (e) {
      console.error('handle error:', e.message);
      res.send('success');
    }
  }
}

module.exports = new WechatController();
