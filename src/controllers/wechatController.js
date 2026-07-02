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

    console.log('=== 微信验证请求 ===');
    console.log('query 参数:', req.query);
    console.log('token:', token, '(类型:', typeof token, ')');

    if (!token) {
      console.error('WECHAT_TOKEN 未设置！');
      res.type('text/plain');
      return res.send('');
    }

    if (!signature || !timestamp || !nonce || !echostr) {
      console.error('缺少必要参数:', { signature: !!signature, timestamp: !!timestamp, nonce: !!nonce, echostr: !!echostr });
      res.type('text/plain');
      return res.send('');
    }

    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');
    console.log('排序后拼接:', str);

    const sha1 = crypto.createHash('sha1');
    sha1.update(str, 'utf-8');
    const hashCode = sha1.digest('hex');

    console.log('计算结果:', hashCode);
    console.log('微信签名:', signature);
    console.log('匹配结果:', hashCode === signature);

    if (hashCode === signature) {
      console.log('验证成功！返回 echostr');
      res.type('text/plain');
      res.send(echostr);
    } else {
      console.log('验证失败：hash 不匹配');
      res.type('text/plain');
      res.send('');
    }
  }

  async handleMessage(req, res) {
    try {
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
