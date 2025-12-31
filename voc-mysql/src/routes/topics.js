import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// GET /api/topics
// 获取所有专题配置
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM topic_configs ORDER BY created_at DESC');
    
    // 处理 JSON 字段
    const data = rows.map(row => ({
      ...row,
      keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords
    }));
    
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '获取专题失败' });
  }
});

// POST /api/topics
// 创建新专题
router.post('/', async (req, res) => {
  const { name, keywords } = req.body;
  
  if (!name || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: '名称和关键词必填' });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO topic_configs (name, keywords, is_active) VALUES (?, ?, 1)',
      [name, JSON.stringify(keywords)]
    );
    res.json({ success: true, id: result.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '创建专题失败' });
  }
});

// DELETE /api/topics/:id
// 删除专题
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM topic_configs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '删除失败' });
  }
});

export default router;