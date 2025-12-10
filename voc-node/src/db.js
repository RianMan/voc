import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/voc.db');

const db = new Database(DB_PATH);

// ==================== 建表 ====================
db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'operator',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- 评论状态表
  CREATE TABLE IF NOT EXISTS review_status (
    review_id TEXT PRIMARY KEY,
    source TEXT DEFAULT 'google_play',
    status TEXT DEFAULT 'pending',
    assignee TEXT,
    note TEXT,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 状态变更日志
  CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 问题备注表
  CREATE TABLE IF NOT EXISTS review_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 报告存档表
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
    generated_by INTEGER,
    generated_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 邮件订阅配置表
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

  -- App配置表
  CREATE TABLE IF NOT EXISTS app_configs (
    app_id TEXT PRIMARY KEY,
    app_name TEXT NOT NULL,
    country TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_review_status ON review_status(status);
  CREATE INDEX IF NOT EXISTS idx_logs_review_id ON status_logs(review_id);
  CREATE INDEX IF NOT EXISTS idx_notes_review_id ON review_notes(review_id);
  CREATE INDEX IF NOT EXISTS idx_reports_app_id ON reports(app_id);
`);

// ==================== 密码工具 ====================
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verify;
}

// ==================== 用户管理 ====================
export function createUser(username, password, displayName, role = 'operator') {
  const passwordHash = hashPassword(password);
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role)
    VALUES (?, ?, ?, ?)
  `);
  try {
    const result = stmt.run(username, passwordHash, displayName, role);
    return { success: true, id: result.lastInsertRowid };
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: '用户名已存在' };
    }
    throw e;
  }
}

export function authenticateUser(username, password) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1');
  const user = stmt.get(username);
  
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }
  
  // 更新最后登录时间
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  
  // 返回用户信息（不含密码）
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, display_name, role, is_active, created_at, last_login FROM users WHERE id = ?');
  return stmt.get(id);
}

export function getAllUsers() {
  const stmt = db.prepare('SELECT id, username, display_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC');
  return stmt.all();
}

export function updateUser(id, data) {
  const fields = [];
  const values = [];
  
  if (data.displayName !== undefined) {
    fields.push('display_name = ?');
    values.push(data.displayName);
  }
  if (data.role !== undefined) {
    fields.push('role = ?');
    values.push(data.role);
  }
  if (data.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(data.isActive ? 1 : 0);
  }
  if (data.password) {
    fields.push('password_hash = ?');
    values.push(hashPassword(data.password));
  }
  
  if (fields.length === 0) return { success: false };
  
  values.push(id);
  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  return { success: true };
}

export function deleteUser(id) {
  const stmt = db.prepare('UPDATE users SET is_active = 0 WHERE id = ?');
  stmt.run(id);
  return { success: true };
}

// 初始化默认管理员
export function initDefaultAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    createUser('admin', 'admin123', '管理员', 'admin');
    console.log('[DB] 已创建默认管理员账号: admin / admin123');
  }
}

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

export const ACTIVE_STATUSES = ['pending', 'confirmed', 'reported', 'in_progress'];

// ==================== 评论状态操作 ====================
export function getStatus(reviewId) {
  const stmt = db.prepare('SELECT * FROM review_status WHERE review_id = ?');
  return stmt.get(reviewId);
}

export function getStatusBatch(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return {};
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT review_id, status, note, updated_at, updated_by FROM review_status WHERE review_id IN (${placeholders})`);
  const rows = stmt.all(...reviewIds);
  
  const statusMap = {};
  rows.forEach(row => {
    statusMap[row.review_id] = row;
  });
  return statusMap;
}

export function updateStatus(reviewId, newStatus, user = null, note = '', source = 'google_play') {
  const existing = getStatus(reviewId);
  const oldStatus = existing?.status || null;
  
  const userId = user?.id || null;
  const userName = user?.display_name || user?.username || 'system';
  
  const upsert = db.prepare(`
    INSERT INTO review_status (review_id, source, status, note, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(review_id) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `);
  upsert.run(reviewId, source, newStatus, note, userId);
  
  // 记录日志
  const logStmt = db.prepare(`
    INSERT INTO status_logs (review_id, old_status, new_status, user_id, user_name, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  logStmt.run(reviewId, oldStatus, newStatus, userId, userName, note);
  
  return { reviewId, oldStatus, newStatus, updatedBy: userName };
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

// ==================== 问题备注 ====================
export function addNote(reviewId, userId, userName, content) {
  const stmt = db.prepare(`
    INSERT INTO review_notes (review_id, user_id, user_name, content)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(reviewId, userId, userName, content);
  return { success: true, id: result.lastInsertRowid };
}

export function getNotes(reviewId) {
  const stmt = db.prepare(`
    SELECT * FROM review_notes 
    WHERE review_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(reviewId);
}

export function getNotesCount(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return {};
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT review_id, COUNT(*) as count 
    FROM review_notes 
    WHERE review_id IN (${placeholders})
    GROUP BY review_id
  `);
  const rows = stmt.all(...reviewIds);
  
  const countMap = {};
  rows.forEach(row => {
    countMap[row.review_id] = row.count;
  });
  return countMap;
}

// ==================== 报告存档操作 ====================
export function saveReport(reportData, user = null) {
  const stmt = db.prepare(`
    INSERT INTO reports (
      app_id, app_name, report_type, week_number, year, title, content,
      summary_stats, compared_with_last, total_issues, new_issues, 
      resolved_issues, pending_issues, generated_by, generated_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    reportData.pendingIssues || 0,
    user?.id || null,
    user?.display_name || user?.username || null
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

// 启动时初始化
initDefaultAdmin();

export default db;
