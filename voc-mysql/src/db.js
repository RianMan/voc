import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 数据库连接池 ====================
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'voc_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('[MySQL] 数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('[MySQL] 数据库连接失败:', err.message);
  });

// ==================== 价格配置 ====================
const PRICING = {
  deepseek: { input: 2.0, output: 3.0 },
  qwen: { input: 3.2, output: 12.8 }
};

// ==================== AI费用记录 ====================
export async function recordAICost(provider, model, type, usage) {
  if (!usage) return 0;

  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  
  const prices = provider.includes('qwen') || provider.includes('aliyun') 
    ? PRICING.qwen 
    : PRICING.deepseek;

  const cost = (input / 1000000 * prices.input) + (output / 1000000 * prices.output);

  await pool.execute(
    `INSERT INTO ai_costs (provider, model, operation_type, input_tokens, output_tokens, total_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [provider, model, type, input, output, cost]
  );
  
  return cost;
}

export async function getCostStats() {
  const [totalRows] = await pool.execute('SELECT SUM(total_cost) as total FROM ai_costs');
  
  const [weeklyRows] = await pool.execute(`
    SELECT SUM(total_cost) as total 
    FROM ai_costs 
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
  `);

  const [byTypeRows] = await pool.execute(`
    SELECT operation_type, SUM(total_cost) as cost, SUM(output_tokens) as tokens
    FROM ai_costs 
    GROUP BY operation_type
  `);

  return {
    total: totalRows[0]?.total || 0,
    weekly: weeklyRows[0]?.total || 0,
    breakdown: byTypeRows
  };
}

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
export async function createUser(username, password, displayName, role = 'operator') {
  const passwordHash = hashPassword(password);
  try {
    const [result] = await pool.execute(
      `INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
      [username, passwordHash, displayName, role]
    );
    return { success: true, id: result.insertId };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return { success: false, error: '用户名已存在' };
    }
    throw e;
  }
}

export async function authenticateUser(username, password) {
  const [rows] = await pool.execute(
    'SELECT * FROM users WHERE username = ? AND is_active = 1',
    [username]
  );
  const user = rows[0];
  
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }
  
  await pool.execute(
    'UPDATE users SET last_login = NOW() WHERE id = ?',
    [user.id]
  );
  
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export async function getUserById(id) {
  const [rows] = await pool.execute(
    'SELECT id, username, display_name, role, is_active, created_at, last_login FROM users WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

export async function getAllUsers() {
  const [rows] = await pool.execute(
    'SELECT id, username, display_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
  );
  return rows;
}

export async function updateUser(id, data) {
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
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return { success: true };
}

export async function deleteUser(id) {
  await pool.execute('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  return { success: true };
}

// 初始化默认管理员
export async function initDefaultAdmin() {
  const [rows] = await pool.execute('SELECT id FROM users WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    await createUser('admin', 'admin123', '管理员', 'admin');
    console.log('[MySQL] 已创建默认管理员账号: admin / admin123');
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
export async function getStatus(reviewId) {
  const [rows] = await pool.execute(
    'SELECT * FROM review_status WHERE review_id = ?',
    [reviewId]
  );
  return rows[0] || null;
}

export async function getStatusBatch(reviewIds) {
  if (!reviewIds || reviewIds.length === 0) return {};
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT review_id, status, note, updated_at, updated_by FROM review_status WHERE review_id IN (${placeholders})`,
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
  
  await pool.execute(
    `INSERT INTO review_status (review_id, source, status, note, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       note = VALUES(note),
       updated_by = VALUES(updated_by),
       updated_at = NOW()`,
    [reviewId, source, newStatus, note, userId]
  );
  
  await pool.execute(
    `INSERT INTO status_logs (review_id, old_status, new_status, user_id, user_name, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reviewId, oldStatus, newStatus, userId, userName, note]
  );
  
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

// ==================== 报告存档操作 ====================
export async function saveReport(reportData, user = null) {
  const [result] = await pool.execute(
    `INSERT INTO reports (
      app_id, app_name, report_type, week_number, year, title, content,
      summary_stats, compared_with_last, total_issues, new_issues, 
      resolved_issues, pending_issues, generated_by, generated_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ]
  );
  
  return result.insertId;
}

export async function getReportsByApp(appId, limit = 20) {
  const limitStr = String(parseInt(limit, 10) || 50);
  const [rows] = await pool.execute(
    `SELECT * FROM reports WHERE app_id = ? ORDER BY created_at DESC LIMIT ?`,
    [appId, limitStr]
  );
  return rows;
}

export async function getReportById(id) {
  const [rows] = await pool.execute('SELECT * FROM reports WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function getLastReport(appId) {
  const [rows] = await pool.execute(
    `SELECT * FROM reports WHERE app_id = ? ORDER BY created_at DESC LIMIT 1`,
    [appId]
  );
  return rows[0] || null;
}

export async function getAllReports(limit = 50) {
  const limitStr = String(parseInt(limit, 10) || 50);
  const [rows] = await pool.execute(
    `SELECT * FROM reports ORDER BY created_at DESC LIMIT ?`,
    [limitStr]
  );
  return rows;
}

// ==================== App配置操作 ====================
export async function upsertAppConfig(appId, appName, country) {
  await pool.execute(
    `INSERT INTO app_configs (app_id, app_name, country, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       app_name = VALUES(app_name),
       country = VALUES(country)`,
    [appId, appName, country]
  );
}

export async function getAllApps() {
  const [rows] = await pool.execute('SELECT * FROM app_configs WHERE is_active = 1');
  return rows;
}

// ==================== 周报相关查询（供 reportGenV2 使用）====================
export async function getWeeklyStatusLogs(reviewIds, daysBack = 7) {
  if (!reviewIds || reviewIds.length === 0) return [];
  
  const placeholders = reviewIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT 
      sl.*,
      rs.status as current_status
    FROM status_logs sl
    LEFT JOIN review_status rs ON sl.review_id = rs.review_id
    WHERE sl.review_id IN (${placeholders})
      AND sl.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    ORDER BY sl.created_at DESC`,
    [...reviewIds, daysBack]
  );
  
  return rows;
}

// 启动时初始化
initDefaultAdmin().catch(console.error);

export { pool };
export default pool;
