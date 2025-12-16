import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 更新状态
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const user = req.user; // 从 token 解析出来的用户信息

  try {
    // 1. 获取旧状态 (用于记录日志)
    const oldItem = await prisma.feedback.findUnique({ where: { id } });
    if (!oldItem) return res.status(404).json({ error: '未找到记录' });

    // 2. 事务更新: 更新主表 + 插入日志
    const result = await prisma.$transaction([
      prisma.feedback.update({
        where: { id },
        data: { 
          status,
          statusNote: note,
          assigneeId: user.userId 
        }
      }),
      prisma.statusLog.create({
        data: {
          feedbackId: id,
          oldStatus: oldItem.status,
          newStatus: status,
          userId: user.userId,
          userName: user.username,
          note: note
        }
      })
    ]);

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('[API] 状态更新失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 获取状态变更历史
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const logs = await prisma.statusLog.findMany({
      where: { feedbackId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: '获取历史失败' });
  }
});

export default router;