const crypto = require('crypto');

// 读取环境变量（每次访问时读取，确保 Railway 变量生效）
function getConfig() {
  return {
    token: process.env.WECHAT_TOKEN,
    appId: process.env.WECHAT_APPID,
    appSecret: process.env.WECHAT_APPSECRET
  };
}

module.exports = { getConfig };
