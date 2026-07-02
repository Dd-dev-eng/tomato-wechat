// 使用 getter 懒加载，确保每次访问都从 process.env 读取
module.exports = {
  get appId() { return process.env.WECHAT_APPID; },
  get appSecret() { return process.env.WECHAT_APPSECRET; },
  get token() { return process.env.WECHAT_TOKEN; },
  get encodingAESKey() { return process.env.WECHAT_ENCODING_AES_KEY; }
};
