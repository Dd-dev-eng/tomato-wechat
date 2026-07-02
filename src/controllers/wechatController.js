const crypto = require('crypto');
const wechatConfig = require('../config/wechat');
const messageHandler = require('../services/messageHandler');

const parseXML = (xml) => {
  const result = {};
  const tagRegex = /<(\w+)>(?:<!\[CDATA\[)?([^\]]+?)(?:\]\]>)?<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
};

class WechatController {
  verify(req, res) {
    const { signature, timestamp, nonce, echostr } = req.query;
    const token = wechatConfig.token;

    console.log('微信验证请求:', { signature, timestamp, nonce, echostr: echostr ? echostr.substring(0, 20) : '', token });

    if (!token) {
      console.error('WECHAT_TOKEN 未设置！当前值:', token);
      return res.send('');
    }

    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');
    const sha1 = crypto.createHash('sha1');
    sha1.update(str);
    const hashCode = sha1.digest('hex');

    console.log('验证结果:', { hashCode, signature, match: hashCode === signature });

    if (hashCode === signature) {
      console.log('验证成功，返回:', echostr);
      res.send(echostr);
    } else {
      console.log('验证失败');
      res.send('');
    }
  }

  async handleMessage(req, res) {
    try {
      // body-parser 已经把 XML 解析到 req.body 了
      const xmlData = req.body;
      if (!xmlData) {
        console.error('收到空的请求体');
        res.send('');
        return;
      }

      const msg = parseXML(xmlData);
      console.log('收到微信消息:', JSON.stringify(msg));
      const reply = await messageHandler.handleMessage(msg);
      res.set('Content-Type', 'application/xml');
      res.send(reply);
    } catch (error) {
      console.error('处理微信消息错误:', error);
      res.send('');
    }
  }
}

module.exports = new WechatController();
