import pool from './connection.js';

// ==================== VOC 统计与趋势查询 ====================

/**
 * 获取 VOC 统计数据（不分页）
 */
export async function getVocStats(appId, month) {
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

   if (month) {
    sql += ' AND DATE_FORMAT(feedback_time, "%Y-%m") = ?';
    params.push(month);
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
export async function getVocTrend(appId, month, weeks = 8) {
  let sql, params;
  
  if (month) {
    // 👇 按月查询：返回该月所有周的数据
    const [year, monthNum] = month.split('-').map(Number);
    
    // 计算该月的第一天和最后一天
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);
    lastDay.setHours(23, 59, 59, 999);
    
    sql = `
      SELECT 
        YEARWEEK(feedback_time, 1) as week_key,
        YEAR(feedback_time) as year,
        WEEK(feedback_time, 1) as week,
        COUNT(*) as total,
        SUM(CASE WHEN category IN ('Positive', 'Other') THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN category NOT IN ('Positive', 'Other') THEN 1 ELSE 0 END) as negative
      FROM voc_feedbacks
      WHERE process_status = 'analyzed'
        AND feedback_time >= ?
        AND feedback_time <= ?
    `;
    
    params = [firstDay.toISOString(), lastDay.toISOString()];
    
  } else {
    // 👇 按周查询：最近 N 周
    sql = `
      SELECT 
        YEARWEEK(feedback_time, 1) as week_key,
        YEAR(feedback_time) as year,
        WEEK(feedback_time, 1) as week,
        COUNT(*) as total,
        SUM(CASE WHEN category IN ('Positive', 'Other') THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN category NOT IN ('Positive', 'Other') THEN 1 ELSE 0 END) as negative
      FROM voc_feedbacks
      WHERE process_status = 'analyzed'
        AND feedback_time >= DATE_SUB(NOW(), INTERVAL ? WEEK)
    `;
    
    params = [parseInt(weeks)];
  }
  
  // App 筛选
  if (appId && appId !== 'All') {
    sql += ' AND app_id = ?';
    params.push(appId);
  }
  
  sql += ' GROUP BY week_key, year, week ORDER BY week_key ASC';
  
  const [rows] = await pool.execute(sql, params);
  
  // 👇 如果没有数据，返回空数组（前端会显示"暂无数据"）
  if (rows.length === 0) {
    return [];
  }
  
  return rows;
}