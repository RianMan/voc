import pool from './connection.js';

// ==================== VOC 统计与趋势查询 ====================

/**
 * 获取趋势分析数据 (修改版：聚合所有情感数据)
 * 返回：date_key, total_count, positive_count, neutral_count, negative_count
 */
export async function getTrendAnalysis({ appId, period = 'week', limit = 8 }) {
  let dateFormat;
  let interval;

  switch (period) {
    case 'day':
      dateFormat = '%Y-%m-%d';
      interval = 'DAY';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      interval = 'MONTH';
      break;
    case 'week':
    default:
      dateFormat = '%x-W%v'; 
      interval = 'WEEK';
      break;
  }

  // ✅ 修改 SQL：移除 sentiment 筛选，改为 SUM CASE 统计各情感数量
  let sql = `
    SELECT 
      DATE_FORMAT(feedback_time, ?) as date_key,
      COUNT(*) as total_count,
      SUM(CASE WHEN sentiment = 'Positive' THEN 1 ELSE 0 END) as positive_count,
      SUM(CASE WHEN sentiment = 'Neutral' THEN 1 ELSE 0 END) as neutral_count,
      SUM(CASE WHEN sentiment = 'Negative' THEN 1 ELSE 0 END) as negative_count
    FROM voc_feedbacks
    WHERE app_id = ?
      AND process_status = 'analyzed'
      AND feedback_time >= DATE_SUB(NOW(), INTERVAL ? ${interval})
    GROUP BY date_key
    ORDER BY date_key ASC
  `;

  // 参数：时间格式, appId, 时间范围数值
  const params = [dateFormat, appId, parseInt(limit) + 1];

  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 获取统计概览 (保持不变)
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



// 兼容旧接口 (防止报错)
export async function getVocTrend(appId, month, weeks) {
    return []; 
}
