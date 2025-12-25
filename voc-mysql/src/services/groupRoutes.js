import express from 'express';
import pool from '../db/index.js';

const router = express.Router();

/**
 * GET /api/groups
 * 获取问题分组列表（按App + 月份聚类）
 */
router.get('/groups', async (req, res) => {
  try {
    const { appId, year, month } = req.query;
    
    let sql = `
      SELECT 
        rg.*,
        (SELECT app_name FROM voc_feedbacks WHERE app_id = rg.app_id LIMIT 1) as app_name
      FROM review_groups rg
      WHERE 1=1
    `;
    const params = [];
    
    if (appId && appId !== 'All') {
      sql += ' AND rg.app_id = ?';
      params.push(appId);
    }
    
    // 添加月份筛选
    if (year) {
      sql += ' AND rg.year = ?';
      params.push(parseInt(year));
    }
    if (month) {
      sql += ' AND rg.month = ?';
      params.push(parseInt(month));
    }
    
    sql += ' ORDER BY rg.app_id, rg.group_rank ASC';
    
    const [rows] = await pool.execute(sql, params);
    
    // 解析JSON字段
    const formattedRows = rows.map(row => ({
      ...row,
      review_ids: typeof row.review_ids === 'string' ? JSON.parse(row.review_ids) : row.review_ids,
      sample_reviews: typeof row.sample_reviews === 'string' ? JSON.parse(row.sample_reviews) : row.sample_reviews
    }));
    
    res.json({ success: true, data: formattedRows });
  } catch (e) {
    console.error('[Groups] Get failed:', e);
    res.status(500).json({ error: 'Get groups failed' });
  }
});

/**
 * GET /api/groups/:id
 * 获取单个分组详情
 */
router.get('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT 
        rg.*,
        (SELECT app_name FROM voc_feedbacks WHERE app_id = rg.app_id LIMIT 1) as app_name
      FROM review_groups rg
      WHERE rg.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const group = rows[0];
    group.review_ids = typeof group.review_ids === 'string' ? JSON.parse(group.review_ids) : group.review_ids;
    group.sample_reviews = typeof group.sample_reviews === 'string' ? JSON.parse(group.sample_reviews) : group.sample_reviews;
    
    res.json({ success: true, data: group });
  } catch (e) {
    console.error('[Groups] Get detail failed:', e);
    res.status(500).json({ error: 'Get group detail failed' });
  }
});

/**
 * GET /api/groups/:id/reviews
 * 获取分组下的所有评论详情
 */
router.get('/groups/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先获取分组的review_ids
    const [groupRows] = await pool.execute(
      'SELECT review_ids FROM review_groups WHERE id = ?',
      [id]
    );
    
    if (groupRows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const reviewIds = typeof groupRows[0].review_ids === 'string' 
      ? JSON.parse(groupRows[0].review_ids) 
      : groupRows[0].review_ids;
    
    if (reviewIds.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    // 获取所有评论详情
    const placeholders = reviewIds.map(() => '?').join(',');
    const [reviews] = await pool.execute(`
      SELECT 
        f.id,
        f.app_id as appId,
        f.app_name as appName,
        f.source,
        f.source_url as sourceUrl,
        f.country,
        f.feedback_time as date,
        m.original_content as text,
        m.translated_content as translated_text,
        f.summary,
        f.category,
        f.risk_level,
        f.status,
        f.root_cause,
        f.action_advice
      FROM voc_feedbacks f
      LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1
      WHERE f.id IN (${placeholders})
      ORDER BY f.feedback_time DESC
    `, reviewIds);
    
    res.json({ success: true, data: reviews });
  } catch (e) {
    console.error('[Groups] Get reviews failed:', e);
    res.status(500).json({ error: 'Get group reviews failed' });
  }
});

/**
 * PUT /api/groups/:id/status
 * 更新分组状态
 */
router.put('/groups/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.execute(
      'UPDATE review_groups SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    
    res.json({ success: true });
  } catch (e) {
    console.error('[Groups] Update status failed:', e);
    res.status(500).json({ error: 'Update status failed' });
  }
});

/**
 * GET /api/groups/summary
 * 获取统计摘要
 */
router.get('/groups/summary', async (req, res) => {
  try {
    const { appId, year, month } = req.query;
    
    let sql = 'SELECT COUNT(*) as total, SUM(review_count) as total_reviews FROM review_groups WHERE 1=1';
    const params = [];
    
    if (appId && appId !== 'All') {
      sql += ' AND app_id = ?';
      params.push(appId);
    }
    if (year) {
      sql += ' AND year = ?';
      params.push(parseInt(year));
    }
    if (month) {
      sql += ' AND month = ?';
      params.push(parseInt(month));
    }
    
    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    console.error('[Groups] Get summary failed:', e);
    res.status(500).json({ error: 'Get summary failed' });
  }
});

/**
 * POST /api/groups/refresh
 * 手动触发重新聚类（仅标记需要刷新，实际执行由脚本完成）
 */
router.post('/groups/refresh', async (req, res) => {
  try {
    const { appId, year, month } = req.body;
    
    // 这里只是个占位接口，实际聚类由 analyzeGroups.js 脚本执行
    res.json({ 
      success: true, 
      message: '请执行命令: node src/analyzeGroups.js ' + [appId, year, month].filter(Boolean).join(' ')
    });
  } catch (e) {
    console.error('[Groups] Refresh failed:', e);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

export default router;
