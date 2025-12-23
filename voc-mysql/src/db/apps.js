import pool from './connection.js';

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