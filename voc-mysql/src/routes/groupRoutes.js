import express from 'express';
import pool from '../db/index.js';

const router = express.Router();

/**
 * GET /api/groups
 * 获取问题分组列表（按App + 月份聚类）
 * 优化：增加 source_breakdown 统计
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
    
    // 并行处理每个分组，获取来源统计
    const formattedRows = await Promise.all(rows.map(async (row) => {
      const reviewIds = typeof row.review_ids === 'string' ? JSON.parse(row.review_ids) : row.review_ids;
      const sampleReviews = typeof row.sample_reviews === 'string' ? JSON.parse(row.sample_reviews) : row.sample_reviews;
      
      // 统计来源分布
      let sourceBreakdown = { google_play: 0, udesk: 0 };
      
      if (reviewIds && reviewIds.length > 0) {
        // 注意：如果 ID 很多，这里直接 IN 查询可能有效率问题，但对于单页展示的分组（通常reviewIds不会成千上万）是可以接受的
        // 使用 external_id 还是 id 取决于聚类逻辑，这里假设是 id
        const placeholders = reviewIds.map(() => '?').join(',');
        const [sourceRows] = await pool.execute(
          `SELECT source, COUNT(*) as count 
           FROM voc_feedbacks 
           WHERE id IN (${placeholders}) 
           GROUP BY source`,
          reviewIds
        );
        
        sourceRows.forEach(s => {
          if (s.source === 'google_play') sourceBreakdown.google_play = s.count;
          else if (s.source.includes('udesk')) sourceBreakdown.udesk += s.count; // 合并所有 udesk 渠道
        });
      }

      return {
        ...row,
        review_ids: reviewIds,
        sample_reviews: sampleReviews,
        source_breakdown: sourceBreakdown // 新增字段
      };
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
// voc-mysql/src/services/groupRoutes.js

// 1. 修改获取评论详情接口，增加关键字和来源过滤
/**
 * GET /api/groups/:id/reviews
 * 获取分组下的所有评论详情（支持关键字筛选、来源过滤、原文对照及跳转）
 */
router.get('/groups/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword, source } = req.query; // 获取前端传入的筛选参数
    
    // 1. 获取分组对应的评论 ID 列表
    const [groupRows] = await pool.execute('SELECT review_ids FROM review_groups WHERE id = ?', [id]);
    if (groupRows.length === 0) return res.status(404).json({ error: 'Group not found' });
    
    const reviewIds = typeof groupRows[0].review_ids === 'string' ? JSON.parse(groupRows[0].review_ids) : groupRows[0].review_ids;
    if (reviewIds.length === 0) return res.json({ success: true, data: [] });
    
    // 2. 构建基础 SQL
    // 确保查询了 f.source_url (用于GP跳转) 和 m.content/translated_content (用于原文翻译对照)
    let sql = `
      SELECT 
        f.id, 
        f.app_id as appId, 
        f.source, 
        f.source_url as sourceUrl, 
        f.country, 
        f.feedback_time as date, 
        m.content as text, 
        m.translated_content as translated_text,
        f.category, 
        f.risk_level, 
        f.status
      FROM voc_feedbacks f
      LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1
      WHERE f.id IN (${reviewIds.map(() => '?').join(',')})
    `;
    const params = [...reviewIds];

    // 3. 关键字筛选：支持搜索原文和翻译内容
    if (keyword) {
      sql += ` AND (m.content LIKE ? OR m.translated_content LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 4. 来源筛选：支持 Udesk 模糊匹配以覆盖所有在线/电话渠道
    if (source) {
      if (source.includes('udesk')) {
        sql += ` AND f.source LIKE 'udesk%'`; // 匹配所有 udesk_chat, udesk_voice 等
      } else {
        sql += ` AND f.source = ?`;
        params.push(source);
      }
    }
    
    // 5. 按时间倒序排序
    sql += ` ORDER BY f.feedback_time DESC`;
    
    const [reviews] = await pool.execute(sql, params);
    
    // 6. 返回数据
    res.json({ success: true, data: reviews });
  } catch (e) {
    console.error('[Groups] Get group reviews detail failed:', e);
    res.status(500).json({ error: 'Get group reviews failed' });
  }
});;

// 2. 新增接口：更新聚类问题的处理状态和备注
router.put('/groups/:id/processing', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark, operator } = req.body;
    await pool.execute(
      'UPDATE review_groups SET processing_status = ?, remark = ?, operator = ?, updated_at = NOW() WHERE id = ?',
      [status, remark, operator, id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Update processing status failed' });
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
