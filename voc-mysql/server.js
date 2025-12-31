import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './src/routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. API 路由
app.use('/api', routes);

// 2. ✅ 关键修改：托管前端静态资源 (构建后的 dist 文件夹)
// 假设部署时，dist 文件夹位于 voc-mysql 的上一级目录
app.use(express.static(path.join(__dirname, '../dist')));

// 3. ✅ 让所有非 API 请求都返回前端 index.html (支持 React 路由刷新)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});