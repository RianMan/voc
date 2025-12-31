import pool from './connection.js';

// ==================== VOC 统计与趋势查询 ====================

/**
 * 获取趋势分析数据 (核心图表接口)
 */
export async function getTrendAnalysis({ appId, period = 'week', sentiment = 'Positive', limit = 8 }) {
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

  let sql = `
    SELECT 
      DATE_FORMAT(feedback_time, ?) as date_key,
      COUNT(*) as total_count,
      SUM(CASE WHEN source = 'google_play' THEN 1 ELSE 0 END) as google_count,
      SUM(CASE WHEN source LIKE 'udesk%' THEN 1 ELSE 0 END) as udesk_count
    FROM voc_feedbacks
    WHERE app_id = ?
      AND process_status = 'analyzed'
  `;

  const params = [dateFormat, appId];

  // 1. 情感筛选
  if (sentiment && sentiment !== 'All') {
    sql += ' AND sentiment = ?';
    params.push(sentiment);
  }

  // 2. 时间筛选
  sql += ` AND feedback_time >= DATE_SUB(NOW(), INTERVAL ? ${interval})`;
  params.push(parseInt(limit) + 1);

  sql += ` GROUP BY date_key ORDER BY date_key ASC`;

  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 获取统计概览 (Dashboard 顶部卡片)
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

/**
 * 获取情感分布统计 (用于 Dashboard 饼图/柱状图)
 */
export async function getSentimentDistribution({ appId, period = 'week', limit = 8 }) {
  let interval;
  switch (period) {
    case 'day': interval = 'DAY'; break;
    case 'month': interval = 'MONTH'; break;
    case 'week': default: interval = 'WEEK'; break;
  }

  // 使用动态的时间范围，而不是写死的 12
  const sql = `
    SELECT 
      sentiment,
      COUNT(*) as count
    FROM voc_feedbacks
    WHERE app_id = ?
      AND process_status = 'analyzed'
      AND feedback_time >= DATE_SUB(NOW(), INTERVAL ? ${interval})
    GROUP BY sentiment
  `;

  const [rows] = await pool.execute(sql, [appId, parseInt(limit) + 1]);
  
  const map = { Positive: 0, Neutral: 0, Negative: 0 };
  rows.forEach(r => {
    if (map[r.sentiment] !== undefined) {
      map[r.sentiment] = r.count;
    }
  });

  return [
    { name: '好评', value: map.Positive, type: 'Positive' },
    { name: '中评', value: map.Neutral, type: 'Neutral' },
    { name: '差评', value: map.Negative, type: 'Negative' }
  ];
}