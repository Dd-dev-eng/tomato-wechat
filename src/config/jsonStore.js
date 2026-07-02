const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '..', 'data');

// 确保 data 目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

class JsonStore {
  constructor(collectionName) {
    this.file = path.join(DB_DIR, `${collectionName}.json`);
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        return JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      }
    } catch (e) {}
    return {};
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  // ---- CRUD ----

  // 保存或更新
  saveDoc(id, doc) {
    this.data[id] = { ...doc, _id: id, updatedAt: new Date().toISOString() };
    this.save();
    return this.data[id];
  }

  // 查找一个
  findOne(id) {
    return this.data[id] || null;
  }

  // 查找所有（返回数组）
  findAll(filterFn) {
    const all = Object.values(this.data);
    return filterFn ? all.filter(filterFn) : all;
  }

  // 删除
  delete(id) {
    delete this.data[id];
    this.save();
  }
}

module.exports = { JsonStore };
