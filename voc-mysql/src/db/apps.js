import pool from './connection.js';

// ==================== App配置操作 ====================

// export async function upsertAppConfig(appId, appName, country) {
//   await pool.execute(
//     `INSERT INTO app_configs (app_id, app_name, country, is_active)
//      VALUES (?, ?, ?, 1)
//      ON DUPLICATE KEY UPDATE
//        app_name = VALUES(app_name),
//        country = VALUES(country)`,
//     [appId, appName, country]
//   );
// }

export async function getAllApps() {
  const [rows] = await pool.execute('SELECT * FROM app_configs WHERE is_active = 1');
  return rows.map(row => ({
    ...row,
    // 解析 JSON 字符串
    views: typeof row.views === 'string' ? JSON.parse(row.views) : (row.views || []),
    udesk_config: typeof row.udesk_config === 'string' ? JSON.parse(row.udesk_config) : (row.udesk_config || {})
  }));
}

// 创建或更新应用 (接收 views 和 udeskConfig)
export async function upsertAppConfig(appId, appName, country, views, udeskConfig) {
  await pool.execute(
    `INSERT INTO app_configs (app_id, app_name, country, views, udesk_config, is_active)
     VALUES (?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       app_name = VALUES(app_name),
       country = VALUES(country),
       views = VALUES(views),
       udesk_config = VALUES(udesk_config),
       is_active = 1`,
    [
      appId, 
      appName, 
      country, 
      JSON.stringify(views || []), 
      JSON.stringify(udeskConfig || {})
    ]
  );
}

// 删除应用 (软删除)
export async function deleteApp(appId) {
    await pool.execute('UPDATE app_configs SET is_active = 0 WHERE app_id = ?', [appId]);
}