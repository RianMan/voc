import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/voc.db');

// 初始化数据库
const db = new Database(DB_PATH);

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS review_status (
    review_id TEXT PRIMARY KEY,
    source TEXT DEFAULT 'google_play',
    status TEXT DEFAULT 'pending',
    assignee TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    operator TEXT DEFAULT 'system',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_review_status ON review_status(status);
  CREATE INDEX IF NOT EXISTS idx_review_source ON review_status(source);
  CREATE INDEX IF NOT EXISTS idx_logs_review_id ON status_logs(review_id);
`);

// ==================== 状态定义 ====================
export const STATUS = {
  PENDING: 'pending',
  IRRELEVANT: 'irrelevant',
  CONFIRMED: 'confirmed',
  REPORTED: 'reported',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
};

export const STATUS_LABELS = {
  pending: '待处理',
  irrelevant: '无意义',
  confirmed: '已确认',
  reported: '已反馈',
  in_progress: '处理中',
  resolved: '已解决',
};

// ==================== 数据库操作 ====================

export function getStatus(reviewId) {
  const stmt = db.prepare('SELECT * FROM review_status WHERE review_id = ?');
  return stmt.get(reviewId);
}

export function getStatusBatch(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return {};
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT review_id, status, assignee, note, updated_at FROM review_status WHERE review_id IN (${placeholders})`);
  const rows = stmt.all(...reviewIds);
  
  const statusMap = {};
  rows.forEach(row => {
    statusMap[row.review_id] = row;
  });
  return statusMap;
}

export function updateStatus(reviewId, newStatus, operator = 'user', note = '', source = 'google_play') {
  const existing = getStatus(reviewId);
  const oldStatus = existing?.status || null;
  
  const upsert = db.prepare(`
    INSERT INTO review_status (review_id, source, status, note, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(review_id) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP
  `);
  upsert.run(reviewId, source, newStatus, note);
  
  const logStmt = db.prepare(`
    INSERT INTO status_logs (review_id, old_status, new_status, operator, note)
    VALUES (?, ?, ?, ?, ?)
  `);
  logStmt.run(reviewId, oldStatus, newStatus, operator, note);
  
  return { reviewId, oldStatus, newStatus };
}

export function initStatusBatch(reviewIds, source = 'google_play') {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO review_status (review_id, source, status)
    VALUES (?, ?, 'pending')
  `);
  
  const insertMany = db.transaction((ids) => {
    for (const id of ids) {
      insert.run(id, source);
    }
  });
  
  insertMany(reviewIds);
  return reviewIds.length;
}

export function getStatusHistory(reviewId) {
  const stmt = db.prepare(`
    SELECT * FROM status_logs 
    WHERE review_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(reviewId);
}

export function getStatusStats() {
  const stmt = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM review_status 
    GROUP BY status
  `);
  return stmt.all();
}

export function getReviewIdsByStatus(status) {
  const stmt = db.prepare('SELECT review_id FROM review_status WHERE status = ?');
  return stmt.all(status).map(r => r.review_id);
}

export default db;
