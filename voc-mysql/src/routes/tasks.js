import { Router } from 'express';
import pool from '../db/connection.js';

const router = Router();

// POST /api/tasks
// 创建事项 (转化)
router.post('/', async (req, res) => {
  const { 
    sourceType, sourceId, originalProblem,
    title, description, businessValue, 
    startDate, endDate, ownerName 
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. 创建任务
    const [result] = await conn.execute(`
      INSERT INTO action_tasks 
      (source_type, source_id, original_problem, title, description, business_value, start_date, end_date, owner_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [sourceType, sourceId, originalProblem, title, description, businessValue, startDate, endDate, ownerName]);

    const taskId = result.insertId;

    // 2. 回写状态到源表 (标记该问题已转化)
    const table = sourceType === 'topic' ? 'topic_trends' : 'monthly_insights';
    await conn.execute(
      `UPDATE ${table} SET task_id = ? WHERE id = ?`,
      [taskId, sourceId]
    );

    await conn.commit();
    res.json({ success: true, taskId });

  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/tasks
// 获取事项列表
router.get('/', async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM action_tasks WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  try {
    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/tasks/:id
// 更新事项
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    title, description, businessValue, 
    startDate, endDate, ownerName, status 
  } = req.body;

  const fields = [];
  const values = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (businessValue !== undefined) { fields.push('business_value = ?'); values.push(businessValue); }
  if (startDate !== undefined) { fields.push('start_date = ?'); values.push(startDate); }
  if (endDate !== undefined) { fields.push('end_date = ?'); values.push(endDate); }
  if (ownerName !== undefined) { fields.push('owner_name = ?'); values.push(ownerName); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) return res.json({ success: true });

  values.push(id);

  try {
    await pool.execute(`UPDATE action_tasks SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;