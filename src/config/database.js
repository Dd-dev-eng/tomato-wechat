// 使用 JSON 文件存储，无需外部数据库
const { JsonStore } = require('./jsonStore');

const stores = {
  users: new JsonStore('users'),
  activities: new JsonStore('activities'),
  activityPools: new JsonStore('activityPools'),
  sessions: new JsonStore('sessions')
};

const connectDB = async () => {
  console.log('✅ JSON 文件存储已就绪');
};

const disconnectDB = async () => {
  console.log('存储已关闭');
};

module.exports = { connectDB, disconnectDB, stores };
