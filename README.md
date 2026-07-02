# 主动番茄 🍅

一个运行在微信公众号里的主动式番茄钟应用。

## 功能特性

- ✅ **主动承诺**：每次做事前手动确认活动+时长
- ✅ **今日活动池**：设定今日可能进行的活动
- ✅ **完美/半熟番茄**：正向激励用户
- ✅ **定时提醒**：晨间提醒、时间到提醒、超时提醒
- ✅ **今日记录**：查看今日时间线和统计

## 技术栈

- Node.js + Express
- MongoDB + Mongoose
- 微信公众号 API

## 项目结构

```
zhudoongfq/
├── src/
│   ├── config/          # 配置文件
│   ├── controllers/     # 控制器
│   ├── models/          # 数据模型
│   ├── services/        # 业务逻辑
│   ├── middlewares/     # 中间件
│   ├── utils/           # 工具函数
│   └── app.js           # 入口文件
├── .env.example         # 环境变量示例
├── .gitignore
├── package.json
└── README.md
```

## 快速开始

### 1. 微信公众号配置

1. 访问 [微信公众平台](https://mp.weixin.qq.com/) 注册/登录账号
2. 获取 AppID 和 AppSecret
3. 配置服务器地址（URL）、Token 和 EncodingAESKey

### 2. 环境配置

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/tomato_db
WECHAT_APPID=你的AppID
WECHAT_APPSECRET=你的AppSecret
WECHAT_TOKEN=你的Token
WECHAT_ENCODING_AES_KEY=你的EncodingAESKey
```

### 3. 安装依赖

```bash
npm install
```

### 4. 启动 MongoDB

确保本地 MongoDB 服务已启动，或使用 Docker：

```bash
docker run -d -p 27017:27017 --name mongodb mongo
```

### 5. 启动服务

```bash
npm start
```

### 6. 本地开发（使用 ngrok）

微信公众号需要公网可访问的服务器。使用 ngrok 进行本地调试：

```bash
ngrok http 3000
```

将 ngrok 提供的 HTTPS 地址配置到微信公众平台的服务器地址中。

## 部署

### 使用 Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 使用 PM2

```bash
npm install -g pm2
pm2 start src/app.js --name tomato-app
```

## 使用说明

### 菜单功能

- **开始活动**：开始新的番茄钟
- **结束**：结束当前进行的活动
- **今日记录**：查看今日时间线

### 快捷命令

- `开始` / `新活动`：开始新活动
- `结束`：结束当前活动
- `今日记录`：查看记录
- `添加活动 xxx`：添加活动到今日池
- `删除活动 xxx`：从今日池删除活动

## 数据模型

### User（用户）
- openid: 用户唯一标识
- tags: 月/周方向标签
- morningReminderTime: 晨间提醒时间

### DailyActivityPool（今日活动池）
- openid: 用户ID
- date: 日期
- activities: 活动列表

### Activity（活动）
- openid: 用户ID
- name: 活动名称
- plannedDuration: 计划时长（分钟）
- startTime: 开始时间
- endTime: 结束时间
- status: 状态（ongoing/completed/cancelled）
- tomatoType: 番茄类型（perfect/half-ripe）

### UserSession（会话状态）
- openid: 用户ID
- step: 当前步骤
- tempActivityName: 临时活动名

## 开发计划完成情况

- ✅ 项目初始化
- ✅ 数据库设计
- ✅ 微信公众号基础服务
- ✅ 用户管理
- ✅ 活动池功能
- ✅ 活动流程
- ✅ 番茄反馈
- ✅ 提醒服务
- ✅ 今日记录
- ✅ 部署文档

## 许可证

ISC
