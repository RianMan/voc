/**
 * VerificationService.js - 终极修复版
 * 
 * 修复内容：
 * 1. ✅ 修复日期格式问题（Date 对象 → 字符串）
 * 2. ✅ 优化关键词匹配逻辑（搜索更多字段）
 * 3. ✅ 修复 Cluster 匹配（使用正确的 ID）
 * 4. ✅ 增加 AI 智能验证选项（可选）
 * 5. ✅ 处理大数据量情况（分页/采样）
 */

import pool from '../db.js';
import OpenAI from 'openai';
import { recordAICost } from '../db.js';

let aiClient = null;

function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.TONGYI_API_KEY || process.env.DEEPSEEK_API_KEY;
    const baseURL = process.env.TONGYI_API_KEY 
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      : (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');
    aiClient = new OpenAI({ apiKey, baseURL });
  }
  return aiClient;
}

// ==================== 辅助函数 ====================

/**
 * 安全地将日期转为字符串格式
 */
function toDateString(date) {
  if (!date) return null;
  if (typeof date === 'string') return date.split('T')[0]; // 去掉时间部分
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return String(date).split('T')[0];
}

// ==================== 验证配置管理 ====================

export async function createVerificationConfig(data) {
  const {
    app_id: appId,
    issue_type: issueType,
    issue_value: issueValue,
    baseline_start: baselineStart,
    baseline_end: baselineEnd,
    verify_start: verifyStart,
    verify_end: verifyEnd,
    optimization_desc: optimizationDesc = '',
    expected_reduction: expectedReduction,
    created_by: createdBy
  } = data;

  const finalExpectedReduction = expectedReduction ?? null;
  const finalVerifyEnd = verifyEnd ?? null;
  const finalCreatedBy = createdBy ?? null;

  const [result] = await pool.execute(
    `INSERT INTO verification_configs 
     (app_id, issue_type, issue_value, baseline_start, baseline_end, 
      verify_start, verify_end, optimization_desc, expected_reduction, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [appId, issueType, issueValue, baselineStart, baselineEnd, 
     verifyStart, finalVerifyEnd, optimizationDesc, finalExpectedReduction, finalCreatedBy]
  );
  
  return { success: true, id: result.insertId };
}

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

export async function updateVerificationStatus(id, status) {
  await pool.execute(
    'UPDATE verification_configs SET status = ? WHERE id = ?',
    [status, id]
  );
  return { success: true };
}

// ==================== 数据统计查询（终极修复版）====================

/**
 * 统计指定条件的评论数量 - 终极修复版
 */
async function countReviews(options) {
  const { appId, issueType, issueValue, startDate, endDate } = options;
  
  // ✅ 修复1：确保日期是字符串格式
  const startDateStr = toDateString(startDate);
  const endDateStr = toDateString(endDate);
  
  console.log('[countReviews] 开始查询:', {
    appId, issueType, issueValue, 
    startDate: startDateStr, 
    endDate: endDateStr
  });
  
  // 1. 构建基础查询
  let baseSql = `
    FROM voc_feedbacks f
    LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1 AND m.role = 'user'
    WHERE f.app_id = ?
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
  `;
  
  const baseParams = [appId, startDateStr, endDateStr];
  
  // 2. 查询时间范围内的总数
  const [totalRows] = await pool.execute(
    `SELECT COUNT(*) as total ${baseSql}`,
    baseParams
  );
  const total = totalRows[0].total;
  
  console.log(`[countReviews] 时间范围内总数: ${total} (${startDateStr} ~ ${endDateStr})`);
  
  if (total === 0) {
    console.log('[countReviews] 时间范围内无数据');
    return { count: 0, total: 0 };
  }
  
  // 3. 根据问题类型添加匹配条件
  let matchSql = baseSql;
  let matchParams = [...baseParams];
  
  switch (issueType) {
    case 'category':
      console.log(`[countReviews] 匹配分类: ${issueValue}`);
      matchSql += ' AND f.category = ?';
      matchParams.push(issueValue);
      break;
      
    case 'keyword':
      console.log(`[countReviews] 匹配关键词: ${issueValue}`);
      
      // ✅ 修复2：搜索更多字段，包括原文
      matchSql += ` AND (
        m.translated_content LIKE ? OR 
        f.summary LIKE ? OR 
        m.content LIKE ? OR
        f.root_cause LIKE ? OR
        f.action_advice LIKE ?
      )`;
      const keyword = `%${issueValue}%`;
      matchParams.push(keyword, keyword, keyword, keyword, keyword);
      break;
      
    case 'cluster':
      console.log(`[countReviews] 匹配聚类: ${issueValue}`);
      
      // 先查询聚类的 review_ids
      const [clusterRows] = await pool.execute(
        'SELECT review_ids FROM issue_clusters WHERE id = ?',
        [parseInt(issueValue)]
      );
      
      if (clusterRows.length === 0) {
        console.log('[countReviews] 聚类不存在');
        return { count: 0, total };
      }
      
      let reviewIds = clusterRows[0].review_ids;
      
      if (typeof reviewIds === 'string') {
        try {
          reviewIds = JSON.parse(reviewIds);
        } catch (e) {
          console.error('[countReviews] 解析 review_ids 失败:', e);
          return { count: 0, total };
        }
      }
      
      if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        console.log('[countReviews] 聚类为空');
        return { count: 0, total };
      }
      
      console.log(`[countReviews] 聚类包含 ${reviewIds.length} 条评论，ID 示例:`, reviewIds.slice(0, 3));
      
      // ✅ 修复3：尝试两种 ID（数据库主键 id 和 external_id）
      // 先检查聚类存储的是哪种 ID
      const [sampleCheck] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM voc_feedbacks WHERE id IN (${reviewIds.slice(0, 1).map(() => '?').join(',')})`,
        reviewIds.slice(0, 1)
      );
      
      if (sampleCheck[0].cnt > 0) {
        // 使用数据库主键 id
        console.log('[countReviews] 聚类使用的是数据库主键 id');
        matchSql += ` AND f.id IN (${reviewIds.map(() => '?').join(',')})`;
        matchParams.push(...reviewIds);
      } else {
        // 使用 external_id
        console.log('[countReviews] 聚类使用的是 external_id');
        matchSql += ` AND f.external_id IN (${reviewIds.map(() => '?').join(',')})`;
        matchParams.push(...reviewIds);
      }
      break;
      
    default:
      console.error(`[countReviews] 未知的 issueType: ${issueType}`);
      return { count: 0, total };
  }
  
  // 4. 执行匹配查询
  const [matchRows] = await pool.execute(
    `SELECT COUNT(*) as count ${matchSql}`,
    matchParams
  );
  const count = matchRows[0].count;
  
  const ratio = total > 0 ? (count/total*100).toFixed(2) : '0.00';
  console.log(`[countReviews] 匹配结果: ${count} / ${total} = ${ratio}%`);
  
  // ✅ 如果匹配数为 0，打印调试信息
  if (count === 0 && issueType === 'keyword') {
    console.log('[countReviews] 关键词匹配为 0，打印示例数据用于调试...');
    const [samples] = await pool.execute(
      `SELECT f.summary, m.translated_content, m.content 
       ${baseSql} 
       LIMIT 3`,
      baseParams
    );
    samples.forEach((s, i) => {
      console.log(`  样本${i+1}:`, {
        summary: s.summary?.substring(0, 50),
        translated: s.translated_content?.substring(0, 50),
        original: s.content?.substring(0, 50)
      });
    });
  }
  
  return { count, total };
}

// ==================== AI 智能验证（可选功能）====================

/**
 * 使用 AI 智能分析验证结果
 * 适用于：不确定关键词是否准确、想要更深度的分析
 */
/**
 * 使用 AI 智能分析验证结果
 */
async function aiSmartVerification(config, baselineStats, verifyStats) {
  console.log('[AI验证] 开始智能分析...');
  
  const appId = config.app_id;
  
  // ✅ 先转换并检查日期
  const baselineStart = toDateString(config.baseline_start);
  const baselineEnd = toDateString(config.baseline_end);
  const verifyStart = toDateString(config.verify_start);
  const verifyEnd = toDateString(config.verify_end) || toDateString(new Date());
  
  if (!baselineStart || !baselineEnd || !verifyStart || !verifyEnd) {
    console.log('[AI验证] 日期配置不完整，跳过');
    return null;
  }
  
  // 1. 采样数据（避免 token 爆炸）
  const sampleSize = 50;

  const [baselineSamples] = await pool.execute(
    `SELECT f.summary, f.root_cause, m.translated_content
    FROM voc_feedbacks f
    LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1
    WHERE f.app_id = ?
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
    ORDER BY RAND()
    LIMIT 50`,  // ✅ 直接写死数字
    [appId, baselineStart, baselineEnd]
  );

  const [verifySamples] = await pool.execute(
    `SELECT f.summary, f.root_cause, m.translated_content
    FROM voc_feedbacks f
    LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1
    WHERE f.app_id = ?
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
    ORDER BY RAND()
    LIMIT 50`,  // ✅ 直接写死数字
    [appId, verifyStart, verifyEnd]
  );
    
  // 2. 调用 AI 分析
  const client = getAIClient();
  const isQwen = !!process.env.TONGYI_API_KEY;
  const model = isQwen ? 'qwen-plus' : 'deepseek-chat';
  
  const prompt = `你是一位产品运营专家。请分析以下两个时期的用户反馈，判断问题是否得到改善。

## 验证目标
问题类型: ${config.issue_type}
问题描述: ${config.issue_value}
优化措施: ${config.optimization_desc || '未说明'}

## 基准期数据 (${baselineStart} ~ ${baselineEnd})
总数: ${baselineStats.total} 条
匹配数: ${baselineStats.count} 条
样本:
${baselineSamples.map((s, i) => `${i+1}. ${s.summary || s.translated_content?.substring(0, 100) || '无内容'}`).join('\n')}

## 验证期数据 (${verifyStart} ~ ${verifyEnd})
总数: ${verifyStats.total} 条
匹配数: ${verifyStats.count} 条
样本:
${verifySamples.map((s, i) => `${i+1}. ${s.summary || s.translated_content?.substring(0, 100) || '无内容'}`).join('\n')}

请返回 JSON 格式分析：
{
  "actualMatchCount": {
    "baseline": 实际基准期匹配数（重新评估）,
    "verify": 实际验证期匹配数（重新评估）
  },
  "conclusion": "resolved | improved | no_change | worsened",
  "confidenceScore": 0-1 的置信度,
  "analysis": "详细分析（中文，2-3句话）",
  "suggestion": "改进建议"
}`;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 1000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是专业的 VOC 分析专家，擅长判断产品优化效果。' },
      { role: 'user', content: prompt }
    ]
  });

  if (completion.usage) {
    await recordAICost(isQwen ? 'qwen' : 'deepseek', model, 'verification_ai', completion.usage);
  }

  try {
    const result = JSON.parse(completion.choices[0].message.content);
    console.log('[AI验证] 分析完成:', result);
    return result;
  } catch (e) {
    console.error('[AI验证] 解析失败:', e);
    return null;
  }
}

// ✅ 新增函数：快速生成总结（不用 AI 时）
function generateQuickSummary(baseline, verify, changePercent) {
  const baselineRatio = (baseline.count / baseline.total * 100).toFixed(1);
  const verifyRatio = (verify.count / verify.total * 100).toFixed(1);
  
  if (changePercent <= -50) {
    return `问题反馈从 ${baselineRatio}% 降至 ${verifyRatio}%，效果显著，建议持续监控。`;
  } else if (changePercent <= -20) {
    return `问题反馈从 ${baselineRatio}% 降至 ${verifyRatio}%，有所改善，建议继续优化。`;
  } else if (changePercent <= 20) {
    return `问题反馈维持在 ${verifyRatio}% 左右，无明显变化，建议调整优化方案。`;
  } else {
    return `问题反馈从 ${baselineRatio}% 升至 ${verifyRatio}%，需要立即关注并排查原因。`;
  }
}

// ==================== 执行验证对比 ====================

export async function runVerification(configId, options = {}) {
  const { useAI = false } = options; // ✅ 新增：是否使用 AI 验证
  
  console.log(`[runVerification] 开始执行验证 #${configId}${useAI ? ' (AI模式)' : ''}`);
  
  // 1. 获取配置
  const [configRows] = await pool.execute(
    'SELECT * FROM verification_configs WHERE id = ?',
    [configId]
  );
  
  if (configRows.length === 0) {
    throw new Error('验证配置不存在');
  }
  
  const config = configRows[0];
  const today = new Date().toISOString().split('T')[0];
  
  console.log('[runVerification] 配置信息:', {
    app_id: config.app_id,
    issue_type: config.issue_type,
    issue_value: config.issue_value,
    baseline_start: toDateString(config.baseline_start),
    baseline_end: toDateString(config.baseline_end),
    verify_start: toDateString(config.verify_start),
    verify_end: toDateString(config.verify_end) || today
  });
  
  // 2. 计算基准期数据
  console.log('[runVerification] 开始计算基准期...');
  const baselineStats = await countReviews({
    appId: config.app_id,
    issueType: config.issue_type,
    issueValue: config.issue_value,
    startDate: config.baseline_start,
    endDate: config.baseline_end
  });
  
  // 3. 计算验证期数据
  console.log('[runVerification] 开始计算验证期...');
  const verifyStats = await countReviews({
    appId: config.app_id,
    issueType: config.issue_type,
    issueValue: config.issue_value,
    startDate: config.verify_start,
    endDate: config.verify_end || today
  });
  
  // 4. AI 智能验证（可选）
  let aiResult = null;
  if (useAI && (baselineStats.total > 0 || verifyStats.total > 0)) {
    try {
      aiResult = await aiSmartVerification(config, baselineStats, verifyStats);
      
      // 使用 AI 重新评估的匹配数
      if (aiResult && aiResult.actualMatchCount) {
        console.log('[runVerification] 使用 AI 重新评估的匹配数');
        baselineStats.count = aiResult.actualMatchCount.baseline;
        verifyStats.count = aiResult.actualMatchCount.verify;
      }
    } catch (e) {
      console.error('[runVerification] AI 验证失败:', e.message);
    }
  }
  
  // 5. 计算变化
  const baselineRatio = baselineStats.total > 0 
    ? baselineStats.count / baselineStats.total 
    : 0;
  const verifyRatio = verifyStats.total > 0 
    ? verifyStats.count / verifyStats.total 
    : 0;
  
  const countChange = verifyStats.count - baselineStats.count;
  const ratioChange = verifyRatio - baselineRatio;
  
  // 计算变化百分比
  const changePercent = baselineStats.count > 0 
    ? ((verifyStats.count - baselineStats.count) / baselineStats.count) * 100 
    : (verifyStats.count > 0 ? 100 : 0);
  
  console.log('[runVerification] 计算结果:', {
    baselineCount: baselineStats.count,
    baselineTotal: baselineStats.total,
    verifyCount: verifyStats.count,
    verifyTotal: verifyStats.total,
    changePercent: changePercent.toFixed(1)
  });
  
  // 6. 判断结论（AI 优先）
  let conclusion;
  if (aiResult && aiResult.conclusion) {
    conclusion = aiResult.conclusion;
    console.log(`[runVerification] 使用 AI 结论: ${conclusion} (置信度: ${aiResult.confidenceScore})`);
  } else {
    // 传统规则判断
    if (changePercent <= -50) {
      conclusion = 'resolved';
    } else if (changePercent <= -20) {
      conclusion = 'improved';
    } else if (changePercent <= 20) {
      conclusion = 'no_change';
    } else {
      conclusion = 'worsened';
    }
  }
  
  // 7. 保存验证结果
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
  
  // 8. 更新配置状态
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
    conclusionText: getConlusionText(conclusion, changePercent),
    summary: aiResult ? aiResult.analysis : generateQuickSummary(baselineStats, verifyStats, changePercent),
    aiAnalysis: aiResult ? {
      analysis: aiResult.analysis,
      suggestion: aiResult.suggestion,
      confidence: aiResult.confidenceScore
    } : null
  };
}

function getConlusionText(conclusion, changePercent) {
  const texts = {
    resolved: `✅ 已解决 (下降 ${Math.abs(changePercent).toFixed(1)}%)`,
    improved: `📈 有改善 (下降 ${Math.abs(changePercent).toFixed(1)}%)`,
    no_change: `➖ 无明显变化 (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
    worsened: `⚠️ 恶化 (上升 ${changePercent.toFixed(1)}%)`
  };
  return texts[conclusion] || conclusion;
}

export async function runAllVerifications(options = {}) {
  const configs = await getVerificationConfigs({ status: 'monitoring' });
  
  const results = [];
  for (const config of configs) {
    try {
      const result = await runVerification(config.id, options);
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

export async function getVerificationHistory(configId) {
  const [rows] = await pool.execute(
    `SELECT * FROM verification_results WHERE config_id = ? ORDER BY verify_date DESC`,
    [configId]
  );
  return rows;
}

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
  
  return configs.map(c => {
    const changePercent = c.latest_change != null ? Number(c.latest_change) : 0;
    
    return {
      id: c.id,
      issueType: c.issue_type,
      issueValue: c.issue_value,
      optimization: c.optimization_desc,
      status: c.status,
      latestConclusion: c.latest_conclusion,
      changePercent: changePercent,
      conclusionText: c.latest_conclusion 
        ? getConlusionText(c.latest_conclusion, changePercent) 
        : '待验证'
    };
  });
}

export async function quickCreateVerification(data) {
  const { appId, issueType, issueValue, optimizationDate, optimizationDesc, createdBy } = data;
  
  const optDate = new Date(optimizationDate);
  
  const baselineEnd = new Date(optDate);
  baselineEnd.setDate(baselineEnd.getDate() - 1);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setDate(baselineStart.getDate() - 13);
  
  const verifyStart = new Date(optDate);
  
  return createVerificationConfig({
    app_id: appId,
    issue_type: issueType,
    issue_value: issueValue,
    baseline_start: baselineStart.toISOString().split('T')[0],
    baseline_end: baselineEnd.toISOString().split('T')[0],
    verify_start: verifyStart.toISOString().split('T')[0],
    verify_end: null,
    optimization_desc: optimizationDesc ?? '',
    created_by: createdBy
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