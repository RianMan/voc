import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/voc.db');

// 初始化数据库
const db = new Database(DB_PATH);

// 创建表
db.exec(`
  -- 评论状态表
  CREATE TABLE IF NOT EXISTS review_status (
    review_id TEXT PRIMARY KEY,
    source TEXT DEFAULT 'google_play',
    status TEXT DEFAULT 'pending',
    assignee TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 状态变更日志
  CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    operator TEXT DEFAULT 'system',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 【新增】报告存档表
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    app_name TEXT,
    report_type TEXT DEFAULT 'weekly',
    week_number INTEGER,
    year INTEGER,
    title TEXT,
    content TEXT NOT NULL,
    summary_stats TEXT,
    compared_with_last TEXT,
    total_issues INTEGER DEFAULT 0,
    new_issues INTEGER DEFAULT 0,
    resolved_issues INTEGER DEFAULT 0,
    pending_issues INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 【新增】邮件订阅配置表
  CREATE TABLE IF NOT EXISTS email_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    app_name TEXT,
    email TEXT NOT NULL,
    recipient_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id, email)
  );

  -- 【新增】App配置表
  CREATE TABLE IF NOT EXISTS app_configs (
    app_id TEXT PRIMARY KEY,
    app_name TEXT NOT NULL,
    country TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_review_status ON review_status(status);
  CREATE INDEX IF NOT EXISTS idx_review_source ON review_status(source);
  CREATE INDEX IF NOT EXISTS idx_logs_review_id ON status_logs(review_id);
  CREATE INDEX IF NOT EXISTS idx_reports_app_id ON reports(app_id);
  CREATE INDEX IF NOT EXISTS idx_reports_week ON reports(year, week_number);
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

// 需要在报告中显示的状态（排除已解决和无意义）
export const ACTIVE_STATUSES = ['pending', 'confirmed', 'reported', 'in_progress'];

// ==================== 评论状态操作 ====================

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

// ==================== 报告存档操作 ====================

export function saveReport(reportData) {
  const stmt = db.prepare(`
    INSERT INTO reports (
      app_id, app_name, report_type, week_number, year, title, content,
      summary_stats, compared_with_last, total_issues, new_issues, 
      resolved_issues, pending_issues
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    reportData.appId,
    reportData.appName,
    reportData.reportType || 'weekly',
    reportData.weekNumber,
    reportData.year,
    reportData.title,
    reportData.content,
    JSON.stringify(reportData.summaryStats || {}),
    JSON.stringify(reportData.comparedWithLast || {}),
    reportData.totalIssues || 0,
    reportData.newIssues || 0,
    reportData.resolvedIssues || 0,
    reportData.pendingIssues || 0
  );
  
  return result.lastInsertRowid;
}

export function getReportsByApp(appId, limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM reports 
    WHERE app_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(appId, limit);
}

export function getReportById(id) {
  const stmt = db.prepare('SELECT * FROM reports WHERE id = ?');
  return stmt.get(id);
}

export function getLastReport(appId) {
  const stmt = db.prepare(`
    SELECT * FROM reports 
    WHERE app_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `);
  return stmt.get(appId);
}

export function getAllReports(limit = 50) {
  const stmt = db.prepare(`
    SELECT * FROM reports 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

// ==================== 邮件订阅操作 ====================

export function addSubscription(appId, appName, email, recipientName) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO email_subscriptions (app_id, app_name, email, recipient_name, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  return stmt.run(appId, appName, email, recipientName);
}

export function getSubscriptionsByApp(appId) {
  const stmt = db.prepare(`
    SELECT * FROM email_subscriptions 
    WHERE app_id = ? AND is_active = 1
  `);
  return stmt.all(appId);
}

export function getAllSubscriptions() {
  const stmt = db.prepare(`
    SELECT * FROM email_subscriptions 
    WHERE is_active = 1
  `);
  return stmt.all();
}

export function removeSubscription(id) {
  const stmt = db.prepare('UPDATE email_subscriptions SET is_active = 0 WHERE id = ?');
  return stmt.run(id);
}

// ==================== App配置操作 ====================

export function upsertAppConfig(appId, appName, country) {
  const stmt = db.prepare(`
    INSERT INTO app_configs (app_id, app_name, country, is_active)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(app_id) DO UPDATE SET
      app_name = excluded.app_name,
      country = excluded.country
  `);
  return stmt.run(appId, appName, country);
}

export function getAllApps() {
  const stmt = db.prepare('SELECT * FROM app_configs WHERE is_active = 1');
  return stmt.all();
}

export default db;
