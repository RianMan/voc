import { Router } from 'express';
import pool from '../db/connection.js';
// ✅ 关键修复：必须引入 generateTopicTrends
import { generateMonthlyInsights, generateTopicTrends } from '../services/InsightGenerator.js';
import { authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router();

// ================= 反馈提炼 (Insights) =================

// GET /api/insights/monthly
// 获取本月反馈提炼列表
router.get('/monthly', async (req, res) => {
  const { appId, month } = req.query;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM monthly_insights WHERE app_id = ? AND batch_month = ? ORDER BY problem_count DESC',
      [appId, month]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/insights/generate
// 触发 AI 提炼 (反馈)
router.post('/generate', authMiddleware, requireRole('admin'), async (req, res) => {
  const { appId, month } = req.body;
  try {
    const result = await generateMonthlyInsights(appId, month);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ================= 专题趋势 (Topics) =================

// GET /api/insights/topics
// 获取专题监控数据
router.get('/topics', async (req, res) => {
  const { appId, month } = req.query;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM topic_trends WHERE app_id = ? AND batch_month = ?',
      [appId, month]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/insights/topics/generate
// ✅ 关键修复：触发专题分析的接口
router.post('/topics/generate', authMiddleware, requireRole('admin'), async (req, res) => {
  const { appId, month } = req.body;
  try {
    const result = await generateTopicTrends(appId, month);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ================= 通用操作 =================

// PUT /api/insights/:id/mark
// 标记/取消标记
router.put('/:id/mark', async (req, res) => {
  const { id } = req.params;
  const { isMarked, type } = req.body; // type: 'insight' or 'topic'
  
  const table = type === 'topic' ? 'topic_trends' : 'monthly_insights';
  
  try {
    await pool.execute(`UPDATE ${table} SET is_marked = ? WHERE id = ?`, [isMarked, id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;