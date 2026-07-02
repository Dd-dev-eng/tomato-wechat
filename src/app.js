const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 静态文件
app.use(express.static(path.join(__dirname, '..', 'public')));

// 首页
app.get('/', (req, res) => {
  res.send('OK - 主动番茄');
});

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on', PORT);
});
