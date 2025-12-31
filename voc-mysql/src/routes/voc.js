import { Router } from 'express';
import { getVocStats, getTrendAnalysis } from '../db/index.js';

const router = Router();

// 1. 趋势折线图
router.get('/trend-analysis', async (req, res) => {
  try {
    const { appId, period, limit } = req.query;
    // ✅ 不再传递 sentiment，直接获取全量聚合数据
    const data = await getTrendAnalysis({
      appId,
      period,
      limit: limit || 8
    });
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

// 3. 统计卡片
router.get('/stats', async (req, res) => {
  try {
    const { appId, month } = req.query;
    const stats = await getVocStats(appId, month);
    res.json({ success: true, data: stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;