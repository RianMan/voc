import pool from './connection.js';

// ==================== VOC 统计与趋势查询 ====================

/**
 * 获取 VOC 统计数据（不分页）
 */
export async function getVocStats(appId) {
  let sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN risk_level = 'High' THEN 1 ELSE 0 END) as high_risk,
      SUM(CASE WHEN category = 'Compliance_Risk' THEN 1 ELSE 0 END) as compliance,
      SUM(CASE WHEN category = 'Tech_Bug' THEN 1 ELSE 0 END) as tech_bug
    FROM voc_feedbacks
    WHERE process_status = 'analyzed'
  `;
  
  const params = [];
  if (appId && appId !== 'All') {
    sql += ' AND app_id = ?';
    params.push(appId);
  }
  
  const [rows] = await pool.execute(sql, params);
  
  const result = rows[0];
  return {
    total: parseInt(result.total) || 0,
    high_risk: parseInt(result.high_risk) || 0,
    compliance: parseInt(result.compliance) || 0,
    tech_bug: parseInt(result.tech_bug) || 0
  };
}

/**
 * 获取周趋势数据
 */
export async function getVocTrend(appId, weeks = 8) {
  let sql = `
    SELECT 
      YEARWEEK(feedback_time, 1) as week_key,
      YEAR(MIN(feedback_time)) as year,
      WEEK(MIN(feedback_time), 1) as week,
      COUNT(*) as total,
      SUM(CASE WHEN category IN ('Positive', 'Other') THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN category NOT IN ('Positive', 'Other') THEN 1 ELSE 0 END) as negative
    FROM voc_feedbacks
    WHERE process_status = 'analyzed'
      AND feedback_time >= DATE_SUB(NOW(), INTERVAL ? WEEK)
  `;
  
  const params = [parseInt(weeks)];
  if (appId && appId !== 'All') {
    sql += ' AND app_id = ?';
    params.push(appId);
  }
  
  sql += ' GROUP BY week_key ORDER BY week_key ASC';
  
  const [rows] = await pool.execute(sql, params);
  return rows;
}