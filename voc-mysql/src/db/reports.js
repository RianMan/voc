import pool from './connection.js';

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