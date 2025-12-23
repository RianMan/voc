import pool from './connection.js';
import { STATUS, STATUS_LABELS, ACTIVE_STATUSES } from './utils.js';

// 导出常量
export { STATUS, STATUS_LABELS, ACTIVE_STATUSES };

// ==================== 评论状态操作 ====================

export async function getStatus(reviewId) {
  const [rows] = await pool.execute(
    'SELECT id, external_id as review_id, status, note, updated_at, assignee as updated_by FROM voc_feedbacks WHERE external_id = ?',
    [reviewId]
  );
  return rows[0] || null;
}

export async function getStatusBatch(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return {};
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT external_id as review_id, status, note, updated_at, assignee as updated_by 
     FROM voc_feedbacks WHERE external_id IN (${placeholders})`,
    reviewIds
  );
  
  const statusMap = {};
  rows.forEach(row => {
    statusMap[row.review_id] = row;
  });
  return statusMap;
}

export async function updateStatus(reviewId, newStatus, user = null, note = '', source = 'google_play') {
  const existing = await getStatus(reviewId);
  const oldStatus = existing?.status || null;
  
  const userId = user?.id || null;
  const userName = user?.display_name || user?.username || 'system';
  
  // 更新 voc_feedbacks 表
  await pool.execute(
    `UPDATE voc_feedbacks SET status = ?, note = ?, assignee = ?, updated_at = NOW()
     WHERE external_id = ?`,
    [newStatus, note, userName, reviewId]
  );
  
  // 记录日志
  if (existing?.id) {
    await pool.execute(
      `INSERT INTO status_logs (review_id, old_status, new_status, user_id, user_name, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [existing.id, oldStatus, newStatus, userId, userName, note]
    );
  }
  
  return { reviewId, oldStatus, newStatus, updatedBy: userName };
}

export async function initStatusBatch(reviewIds, source = 'google_play') {
  if (!reviewIds || reviewIds.length === 0) return 0;
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    for (const id of reviewIds) {
      await conn.execute(
        `INSERT IGNORE INTO review_status (review_id, source, status) VALUES (?, ?, 'pending')`,
        [id, source]
      );
    }
    
    await conn.commit();
    return reviewIds.length;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getStatusHistory(reviewId) {
  const [rows] = await pool.execute(
    `SELECT * FROM status_logs WHERE review_id = ? ORDER BY created_at DESC`,
    [reviewId]
  );
  return rows;
}

export async function getStatusStats() {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) as count FROM review_status GROUP BY status`
  );
  return rows;
}

// ==================== 问题备注 ====================

export async function addNote(reviewId, userId, userName, content) {
  const [result] = await pool.execute(
    `INSERT INTO review_notes (review_id, user_id, user_name, content) VALUES (?, ?, ?, ?)`,
    [reviewId, userId, userName, content]
  );
  return { success: true, id: result.insertId };
}

export async function getNotes(reviewId) {
  const [rows] = await pool.execute(
    `SELECT * FROM review_notes WHERE review_id = ? ORDER BY created_at DESC`,
    [reviewId]
  );
  return rows;
}

export async function getNotesCount(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return {};
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT review_id, COUNT(*) as count FROM review_notes WHERE review_id IN (${placeholders}) GROUP BY review_id`,
    reviewIds
  );
  
  const countMap = {};
  rows.forEach(row => {
    countMap[row.review_id] = row.count;
  });
  return countMap;
}

// ==================== 周报相关查询 ====================

export async function getWeeklyStatusLogs(reviewIds, daysBack = 7) {
  if (!reviewIds || reviewIds.length === 0) return [];
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT 
      sl.*,
      vf.status as current_status
    FROM status_logs sl
    LEFT JOIN voc_feedbacks vf ON sl.review_id = vf.id
    WHERE sl.review_id IN (${placeholders})
      AND sl.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY sl.created_at DESC`,
    [...reviewIds, daysBack]
  );
  
  return rows;
}