import pool from './connection.js';
import { hashPassword, verifyPassword } from './utils.js';

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

// 启动时自动初始化
initDefaultAdmin().catch(console.error);