/**
 * VerificationService.js
 * 功能3: 闭环效果验证
 * 
 * 职责:
 * 1. 配置验证任务（指定基准期和验证期）
 * 2. 执行前后对比分析
 * 3. 自动判断优化效果
 */

import pool from '../db.js';
import { loadAllReports } from './dataLoader.js';

// ==================== 验证配置管理 ====================

/**
 * 创建验证配置
 */
export async function createVerificationConfig(data) {
  const {
    appId,
    issueType,        // 'category' | 'cluster' | 'keyword'
    issueValue,       // 分类名/聚类ID/关键词
    baselineStart,
    baselineEnd,
    verifyStart,
    verifyEnd,
    optimizationDesc,
    expectedReduction,
    createdBy
  } = data;
  
  const [result] = await pool.execute(
    `INSERT INTO verification_configs 
     (app_id, issue_type, issue_value, baseline_start, baseline_end, 
      verify_start, verify_end, optimization_desc, expected_reduction, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [appId, issueType, issueValue, baselineStart, baselineEnd, 
     verifyStart, verifyEnd || null, optimizationDesc, expectedReduction || null, createdBy || null]
  );
  
  return { success: true, id: result.insertId };
}

/**
 * 获取验证配置列表
 */
export async function getVerificationConfigs(filters = {}) {
  const { appId, status } = filters;
  
  let sql = 'SELECT * FROM verification_configs WHERE 1=1';
  const params = [];
  
  if (appId) { sql += ' AND app_id = ?'; params.push(appId); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  
  sql += ' ORDER BY created_at DESC';
  
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 更新验证配置状态
 */
export async function updateVerificationStatus(id, status) {
  await pool.execute(
    'UPDATE verification_configs SET status = ? WHERE id = ?',
    [status, id]
  );
  return { success: true };
}

// ==================== 数据统计查询 ====================

/**
 * 统计指定条件的评论数量
 * @param {Object} options
 * @returns {Object} { count, total }
 */
async function countReviews(options) {
  const { appId, issueType, issueValue, startDate, endDate } = options;
  
  const allData = loadAllReports();
  
  // 筛选时间范围和App
  let filtered = allData.filter(item => {
    if (item.appId !== appId) return false;
    
    const itemDate = new Date(item.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    return itemDate >= start && itemDate <= end;
  });
  
  const total = filtered.length;
  
  // 按条件筛选目标问题
  let targetCount = 0;
  
  switch (issueType) {
    case 'category':
      targetCount = filtered.filter(item => item.category === issueValue).length;
      break;
      
    case 'keyword':
      targetCount = filtered.filter(item => {
        const text = (item.translated_text || '') + (item.summary || '');
        return text.includes(issueValue);
      }).length;
      break;
      
    case 'cluster':
      // 聚类需要查数据库获取关联的 review_ids
      const [clusterRows] = await pool.execute(
        'SELECT review_ids FROM issue_clusters WHERE id = ?',
        [parseInt(issueValue)]
      );
      if (clusterRows.length > 0) {
        const reviewIds = typeof clusterRows[0].review_ids === 'string' 
          ? JSON.parse(clusterRows[0].review_ids) 
          : clusterRows[0].review_ids;
        targetCount = filtered.filter(item => reviewIds.includes(item.id)).length;
      }
      break;
  }
  
  return { count: targetCount, total };
}

// ==================== 执行验证对比 ====================

/**
 * 执行单个验证配置的对比分析
 */
export async function runVerification(configId) {
  // 获取配置
  const [configRows] = await pool.execute(
    'SELECT * FROM verification_configs WHERE id = ?',
    [configId]
  );
  
  if (configRows.length === 0) {
    throw new Error('验证配置不存在');
  }
  
  const config = configRows[0];
  const today = new Date().toISOString().split('T')[0];
  
  // 计算基准期数据
  const baselineStats = await countReviews({
    appId: config.app_id,
    issueType: config.issue_type,
    issueValue: config.issue_value,
    startDate: config.baseline_start,
    endDate: config.baseline_end
  });
  
  // 计算验证期数据
  const verifyStats = await countReviews({
    appId: config.app_id,
    issueType: config.issue_type,
    issueValue: config.issue_value,
    startDate: config.verify_start,
    endDate: config.verify_end || today
  });
  
  // 计算变化
  const baselineRatio = baselineStats.total > 0 
    ? baselineStats.count / baselineStats.total 
    : 0;
  const verifyRatio = verifyStats.total > 0 
    ? verifyStats.count / verifyStats.total 
    : 0;
  
  const countChange = verifyStats.count - baselineStats.count;
  const ratioChange = verifyRatio - baselineRatio;
  
  // 计算变化百分比（基于数量）
  const changePercent = baselineStats.count > 0 
    ? ((verifyStats.count - baselineStats.count) / baselineStats.count) * 100 
    : 0;
  
  // 判断结论
  let conclusion;
  if (changePercent <= -50) {
    conclusion = 'resolved';  // 下降50%以上，视为已解决
  } else if (changePercent <= -20) {
    conclusion = 'improved';  // 下降20%-50%，有改善
  } else if (changePercent <= 20) {
    conclusion = 'no_change'; // 变化在20%以内，无明显变化
  } else {
    conclusion = 'worsened';  // 上升超过20%，恶化
  }
  
  // 保存验证结果
  await pool.execute(
    `INSERT INTO verification_results 
     (config_id, verify_date, baseline_count, baseline_total, baseline_ratio,
      verify_count, verify_total, verify_ratio, count_change, ratio_change,
      change_percent, conclusion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      configId, today,
      baselineStats.count, baselineStats.total, baselineRatio,
      verifyStats.count, verifyStats.total, verifyRatio,
      countChange, ratioChange, changePercent, conclusion
    ]
  );
  
  // 更新配置状态
  if (conclusion === 'resolved' || conclusion === 'worsened') {
    await updateVerificationStatus(configId, conclusion);
  }
  
  return {
    configId,
    verifyDate: today,
    baseline: {
      count: baselineStats.count,
      total: baselineStats.total,
      ratio: (baselineRatio * 100).toFixed(2) + '%'
    },
    verify: {
      count: verifyStats.count,
      total: verifyStats.total,
      ratio: (verifyRatio * 100).toFixed(2) + '%'
    },
    change: {
      count: countChange,
      percent: changePercent.toFixed(1) + '%'
    },
    conclusion,
    conclusionText: getConlusionText(conclusion, changePercent)
  };
}

/**
 * 获取结论描述文本
 */
function getConlusionText(conclusion, changePercent) {
  const texts = {
    resolved: `✅ 已解决 (下降 ${Math.abs(changePercent).toFixed(1)}%)`,
    improved: `📈 有改善 (下降 ${Math.abs(changePercent).toFixed(1)}%)`,
    no_change: `➖ 无明显变化 (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
    worsened: `⚠️ 恶化 (上升 ${changePercent.toFixed(1)}%)`
  };
  return texts[conclusion] || conclusion;
}

/**
 * 批量执行所有监控中的验证
 */
export async function runAllVerifications() {
  const configs = await getVerificationConfigs({ status: 'monitoring' });
  
  const results = [];
  for (const config of configs) {
    try {
      const result = await runVerification(config.id);
      results.push({ configId: config.id, ...result });
    } catch (e) {
      console.error(`[Verification] Config ${config.id} 失败:`, e.message);
      results.push({ configId: config.id, success: false, error: e.message });
    }
  }
  
  return {
    total: configs.length,
    results,
    summary: {
      resolved: results.filter(r => r.conclusion === 'resolved').length,
      improved: results.filter(r => r.conclusion === 'improved').length,
      no_change: results.filter(r => r.conclusion === 'no_change').length,
      worsened: results.filter(r => r.conclusion === 'worsened').length
    }
  };
}

/**
 * 获取验证历史
 */
export async function getVerificationHistory(configId) {
  const [rows] = await pool.execute(
    `SELECT * FROM verification_results WHERE config_id = ? ORDER BY verify_date DESC`,
    [configId]
  );
  return rows;
}

/**
 * 获取验证摘要（用于周报）
 */
export async function getVerificationSummary(appId) {
  const [configs] = await pool.execute(
    `SELECT vc.*, 
       (SELECT vr.conclusion FROM verification_results vr 
        WHERE vr.config_id = vc.id 
        ORDER BY vr.verify_date DESC LIMIT 1) as latest_conclusion,
       (SELECT vr.change_percent FROM verification_results vr 
        WHERE vr.config_id = vc.id 
        ORDER BY vr.verify_date DESC LIMIT 1) as latest_change
     FROM verification_configs vc 
     WHERE vc.app_id = ?
     ORDER BY vc.created_at DESC`,
    [appId]
  );
  
  return configs.map(c => ({
    id: c.id,
    issueType: c.issue_type,
    issueValue: c.issue_value,
    optimization: c.optimization_desc,
    status: c.status,
    latestConclusion: c.latest_conclusion,
    changePercent: c.latest_change,
    conclusionText: c.latest_conclusion 
      ? getConlusionText(c.latest_conclusion, c.latest_change || 0) 
      : '待验证'
  }));
}

/**
 * 快速创建验证（便捷方法）
 * 默认基准期为优化前2周，验证期从优化日期开始
 */
export async function quickCreateVerification(data) {
  const { appId, issueType, issueValue, optimizationDate, optimizationDesc, createdBy } = data;
  
  const optDate = new Date(optimizationDate);
  
  // 基准期：优化前14天
  const baselineEnd = new Date(optDate);
  baselineEnd.setDate(baselineEnd.getDate() - 1);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setDate(baselineStart.getDate() - 13);
  
  // 验证期：优化日期开始
  const verifyStart = new Date(optDate);
  
  return createVerificationConfig({
    appId,
    issueType,
    issueValue,
    baselineStart: baselineStart.toISOString().split('T')[0],
    baselineEnd: baselineEnd.toISOString().split('T')[0],
    verifyStart: verifyStart.toISOString().split('T')[0],
    verifyEnd: null, // 持续监控
    optimizationDesc,
    createdBy
  });
}

export default {
  createVerificationConfig,
  getVerificationConfigs,
  updateVerificationStatus,
  runVerification,
  runAllVerifications,
  getVerificationHistory,
  getVerificationSummary,
  quickCreateVerification
};
