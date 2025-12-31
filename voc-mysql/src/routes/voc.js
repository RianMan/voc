import { Router } from 'express';
import { getVocStats, getTrendAnalysis, getSentimentDistribution } from '../db/index.js';

const router = Router();

// 1. 趋势折线图
router.get('/trend-analysis', async (req, res) => {
  try {
    const { appId, period, sentiment, limit } = req.query;
    const data = await getTrendAnalysis({
      appId,
      period,
      sentiment,
      limit: limit || 8
    });
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

// 2. 情感分布柱状图 (✅ 修改：接收 limit 参数)
router.get('/sentiment-stats', async (req, res) => {
  try {
    const { appId, period, limit } = req.query; // 接收 limit
    const data = await getSentimentDistribution({ 
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