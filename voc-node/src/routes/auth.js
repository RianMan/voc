import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 密码哈希工具 (简单版，生产环境建议用 bcrypt)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      } 
    });
  } catch (error) {
    res.status(500).json({ error: '登录失败' });
  }
});

// 注册初始管理员 (仅供测试用)
router.post('/init-admin', async (req, res) => {
  try {
    const count = await prisma.user.count();
    if (count > 0) return res.status(403).json({ error: '系统已初始化' });

    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        displayName: '系统管理员',
        role: 'admin'
      }
    });
    res.json({ success: true, user: admin });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;