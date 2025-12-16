import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 路由
import authRoutes from './src/routes/auth.js';
import vocRoutes from './src/routes/voc.js';
import statusRoutes from './src/routes/status.js';
// import reportRoutes from './src/routes/report.js'; // 暂时先注释，稍后修复

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/voc', vocRoutes);       // 现在连接的是 MySQL
app.use('/api/status', statusRoutes); // 现在连接的是 MySQL
// app.use('/api/report', reportRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: 'mysql' });
});

// React Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoints ready (MySQL backed)`);
});