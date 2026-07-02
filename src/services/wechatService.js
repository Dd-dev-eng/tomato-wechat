const axios = require('axios');
const wechatConfig = require('../config/wechat');

let accessToken = null;
let tokenExpireTime = 0;

class WechatService {
  async getAccessToken() {
    const now = Date.now();
    if (accessToken && now < tokenExpireTime) {
      return accessToken;
    }

    try {
      const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: {
          grant_type: 'client_credential',
          appid: wechatConfig.appId,
          secret: wechatConfig.appSecret
        }
      });

      accessToken = response.data.access_token;
      tokenExpireTime = now + (response.data.expires_in - 300) * 1000;
      return accessToken;
    } catch (error) {
      console.error('获取 AccessToken 失败:', error.response?.data || error.message);
      throw error;
    }
  }

  async createMenu(menuConfig) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/menu/create?access_token=${token}`,
        menuConfig
      );
      return response.data;
    } catch (error) {
      console.error('创建菜单失败:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendTemplateMessage(touser, templateId, data, url = '') {
    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
        {
          touser,
          template_id: templateId,
          url,
          data
        }
      );
      return response.data;
    } catch (error) {
      console.error('发送模板消息失败:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendTextMessage(openid, content) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${token}`,
        {
          touser: openid,
          msgtype: 'text',
          text: { content }
        }
      );
      return response.data;
    } catch (error) {
      console.error('发送文本消息失败:', error.response?.data || error.message);
      throw error;
    }
  }

  generateTextReply(toUserName, fromUserName, content) {
    const timestamp = Math.floor(Date.now() / 1000);
    return `<xml>
      <ToUserName><![CDATA[${toUserName}]]></ToUserName>
      <FromUserName><![CDATA[${fromUserName}]]></FromUserName>
      <CreateTime>${timestamp}</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[${content}]]></Content>
    </xml>`;
  }

  generateReplyMenu(toUserName, fromUserName, content, buttons) {
    const timestamp = Math.floor(Date.now() / 1000);
    const buttonItems = buttons.map(btn => 
      `<item>
        <Title><![CDATA[${btn.title}]]></Title>
        <Description><![CDATA[${btn.description || ''}]]></Description>
        <Url><![CDATA[${btn.url || ''}]]></Url>
      </item>`
    ).join('');
    
    return `<xml>
      <ToUserName><![CDATA[${toUserName}]]></ToUserName>
      <FromUserName><![CDATA[${fromUserName}]]></FromUserName>
      <CreateTime>${timestamp}</CreateTime>
      <MsgType><![CDATA[news]]></MsgType>
      <ArticleCount>${buttons.length}</ArticleCount>
      <Articles>${buttonItems}</Articles>
    </xml>`;
  }
}

module.exports = new WechatService();
