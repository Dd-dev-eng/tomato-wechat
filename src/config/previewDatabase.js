const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectPreviewDB = async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('预览模式 - 内存 MongoDB 已启动');
  } catch (error) {
    console.error('预览数据库连接失败:', error);
    process.exit(1);
  }
};

const disconnectPreviewDB = async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
};

module.exports = { connectPreviewDB, disconnectPreviewDB };
