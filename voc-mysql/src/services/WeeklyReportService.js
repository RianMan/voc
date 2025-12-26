/**
 * WeeklyReportService.js
 * 新版本：基于 voc_feedbacks 实时数据生成周维度报告
 */

import OpenAI from 'openai';
import pool from '../db/index.js';
import { recordAICost, saveReport } from '../db/index.js';

// AI Client
let aiClient = null;

function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.TONGYI_API_KEY;
    const baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    aiClient = new OpenAI({ apiKey, baseURL });
  }
  return aiClient;
}

/**
 * 获取周范围
 * @param {number} weekOffset - 周偏移（0=本周，-1=上周）
 */
function getWeekRange(weekOffset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 周日=7
  
  // 本周一
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 + (weekOffset * 7));
  monday.setHours(0, 0, 0, 0);
  
  // 本周日
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    startDate: monday,
    endDate: sunday
  };
}

/**
 * 获取周数
 */
function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { weekNumber, year: d.getUTCFullYear() };
}

/**
 * 获取指定周的数据
 */
async function fetchWeekData(appId, start, end) {
  const [rows] = await pool.execute(`
    SELECT 
      f.id, f.app_id, f.app_name, f.country,
      f.category, f.risk_level, f.status,
      f.summary, f.root_cause, f.action_advice,
      f.feedback_time as date,
      m.translated_content as text
    FROM voc_feedbacks f
    LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1
    WHERE f.app_id = ?
      AND f.process_status = 'analyzed'
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
    ORDER BY f.feedback_time DESC
  `, [appId, start, end]);
  
  return rows;
}

/**
 * AI 临时聚类（不保存数据库）
 */
async function aiWeeklyClustering(reviews) {
  if (reviews.length < 3) {
    return { clusters: [], message: '数据量不足，无法聚类' };
  }
  
  // 只聚类高风险和中风险的问题
  const targetReviews = reviews.filter(r => 
    ['High', 'Medium'].includes(r.risk_level) && 
    !['Positive', 'User_Error'].includes(r.category)
  );
  
  if (targetReviews.length < 3) {
    return { clusters: [], message: '关键问题数量不足' };
  }
  
  const client = getAIClient();
  
  const prompt = `你是产品专家。请将以下 ${targetReviews.length} 条用户反馈聚类成 Top 5 核心问题。

## 输入数据
${JSON.stringify(targetReviews.slice(0, 100).map(r => ({
  summary: r.summary,
  root_cause: r.root_cause,
  category: r.category,
  status: r.status
})), null, 2)}

## 要求
1. 只返回最核心的 3-5 个问题（不要强行凑数）
2. 每个问题必须包含：标题、根因、建议、优先级、处理状态分布
3. 优先级规则：
   - P0：影响核心功能、有法律风险
   - P1：影响用户体验、需本周解决
   - P2：体验优化、可排期

## 输出JSON
{
  "clusters": [
    {
      "rank": 1,
      "title": "问题标题（8字以内）",
      "count": 涉及评论数,
      "percentage": 占比（数字，不带%）,
      "root_cause": "根本原因（1句话）",
      "suggestion": "解决方案（具体可执行）",
      "priority": "P0/P1/P2",
      "status_distribution": "X条待处理，Y条处理中，Z条已解决"
    }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: 'qwen-max',
    max_tokens: 3000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是VOC分析专家，擅长提炼核心问题。用中文回复。' },
      { role: 'user', content: prompt }
    ]
  });

  if (completion.usage) {
    await recordAICost('qwen', 'qwen-max', 'weekly_clustering', completion.usage);
  }

  try {
    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (e) {
    console.error('[WeeklyReport] AI返回解析失败:', e);
    return { clusters: [], error: e.message };
  }
}

/**
 * 周对比分析
 */
function compareWeeks(thisWeek, lastWeek) {
  const calcChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev * 100).toFixed(1);
  };
  
  const thisCategories = {
    Tech_Bug: thisWeek.filter(r => r.category === 'Tech_Bug').length,
    Compliance_Risk: thisWeek.filter(r => r.category === 'Compliance_Risk').length,
    Product_Issue: thisWeek.filter(r => r.category === 'Product_Issue').length
  };
  
  const lastCategories = {
    Tech_Bug: lastWeek.filter(r => r.category === 'Tech_Bug').length,
    Compliance_Risk: lastWeek.filter(r => r.category === 'Compliance_Risk').length,
    Product_Issue: lastWeek.filter(r => r.category === 'Product_Issue').length
  };
  
  const thisHigh = thisWeek.filter(r => r.risk_level === 'High').length;
  const lastHigh = lastWeek.filter(r => r.risk_level === 'High').length;
  
  return {
    totalChange: calcChange(thisWeek.length, lastWeek.length),
    categoryChanges: {
      Tech_Bug: calcChange(thisCategories.Tech_Bug, lastCategories.Tech_Bug),
      Compliance_Risk: calcChange(thisCategories.Compliance_Risk, lastCategories.Compliance_Risk),
      Product_Issue: calcChange(thisCategories.Product_Issue, lastCategories.Product_Issue)
    },
    highRiskChange: calcChange(thisHigh, lastHigh),
    thisWeekStats: {
      total: thisWeek.length,
      high: thisHigh,
      categories: thisCategories
    },
    lastWeekStats: {
      total: lastWeek.length,
      high: lastHigh,
      categories: lastCategories
    }
  };
}

/**
 * 查询本周已解决的问题
 */
async function getResolvedThisWeek(appId, start, end) {
  const [rows] = await pool.execute(`
    SELECT 
      f.summary,
      f.status,
      f.assignee as operator,
      f.note as remark,
      f.updated_at
    FROM voc_feedbacks f
    WHERE f.app_id = ?
      AND f.status = 'resolved'
      AND DATE(f.updated_at) >= ?
      AND DATE(f.updated_at) <= ?
    ORDER BY f.updated_at DESC
    LIMIT 10
  `, [appId, start, end]);
  
  return rows;
}

/**
 * 生成报告文本
 */
async function generateReportText(data) {
  const client = getAIClient();
  
  const { appName, weekNumber, year, overview, clusters, comparison, resolved } = data;
  
  const prompt = `你是产品运营专家。请基于以下数据生成本周VOC周报。

## 基础数据
- App：${appName}
- 周次：${year}年第${weekNumber}周
- 本周总反馈：${overview.total}条
- 高风险：${overview.high}条（${(overview.high/overview.total*100).toFixed(1)}%）
- 已处理：${overview.processed}条

## 对比数据
${JSON.stringify(comparison, null, 2)}

## Top 问题聚类
${JSON.stringify(clusters, null, 2)}

## 本周已解决
${JSON.stringify(resolved.slice(0, 5), null, 2)}

## 要求
1. **不要写标题**（系统自动生成）
2. **结构**：
   - 📊 本周概览（3-5个核心指标，必须包含环比对比）
   - 🔥 Top问题（每个问题：标题+根因+方案+优先级+处理状态）
   - ✅ 已解决问题（列表，简洁）
   - 📈 趋势洞察（1-2句话，点出关键变化）
   - 🎯 下周行动建议（3条，按P0/P1/P2排序）

3. **风格**：
   - 简洁：每个问题控制在3行内
   - 数据驱动：多用数字和对比
   - 行动导向：建议要具体可执行
   - 禁止流水账

请生成报告正文。`;

  const completion = await client.chat.completions.create({
    model: 'qwen-max',
    max_tokens: 4000,
    temperature: 0.3,
    messages: [
      { role: 'system', content: '你是VOC周报专家，生成简洁可执行的周报。' },
      { role: 'user', content: prompt }
    ]
  });

  if (completion.usage) {
    await recordAICost('qwen', 'qwen-max', 'weekly_report', completion.usage);
  }

  return completion.choices[0].message.content.trim();
}

/**
 * 主函数：生成周报
 */
export async function generateWeeklyReport(appId, options = {}, user = null) {
  const { weekOffset = 0 } = options;
  
  console.log(`[WeeklyReport] 开始生成 ${appId} 周报 (weekOffset=${weekOffset})`);
  
  // 1. 计算周范围
  const thisWeek = getWeekRange(weekOffset);
  const lastWeek = getWeekRange(weekOffset - 1);
  const { weekNumber, year } = getWeekNumber(thisWeek.startDate);
  
  console.log(`[WeeklyReport] 时间范围: ${thisWeek.start} ~ ${thisWeek.end}`);
  
  // 2. 获取数据
  const [thisWeekData, lastWeekData] = await Promise.all([
    fetchWeekData(appId, thisWeek.start, thisWeek.end),
    fetchWeekData(appId, lastWeek.start, lastWeek.end)
  ]);
  
  console.log(`[WeeklyReport] 本周数据: ${thisWeekData.length}条，上周: ${lastWeekData.length}条`);
  
  if (thisWeekData.length === 0) {
    return {
      success: false,
      error: '本周无数据',
      message: `${thisWeek.start} ~ ${thisWeek.end} 期间无评论数据`
    };
  }
  
  // 3. 数据分析
  const overview = {
    total: thisWeekData.length,
    high: thisWeekData.filter(d => d.risk_level === 'High').length,
    processed: thisWeekData.filter(d => d.status !== 'pending').length,
    categories: {
      Tech_Bug: thisWeekData.filter(r => r.category === 'Tech_Bug').length,
      Compliance_Risk: thisWeekData.filter(r => r.category === 'Compliance_Risk').length,
      Product_Issue: thisWeekData.filter(r => r.category === 'Product_Issue').length
    }
  };
  
  // 4. AI 聚类
  console.log('[WeeklyReport] 开始AI聚类...');
  const clusterResult = await aiWeeklyClustering(thisWeekData);
  
  // 5. 周对比
  const comparison = compareWeeks(thisWeekData, lastWeekData);
  
  // 6. 已解决问题
  const resolved = await getResolvedThisWeek(appId, thisWeek.start, thisWeek.end);
  
  // 7. 生成报告文本
  console.log('[WeeklyReport] 生成报告文本...');
  const reportBody = await generateReportText({
    appId,
    appName: thisWeekData[0]?.app_name || appId,
    weekNumber,
    year,
    overview,
    clusters: clusterResult.clusters || [],
    comparison,
    resolved
  });
  
  // 8. 拼接完整报告
  const appName = thisWeekData[0]?.app_name || appId;
  const title = `${appName} VOC 周报 ${year}年第${weekNumber}周`;
  const fullReport = `# ${title}\n\n${reportBody}\n\n---\n*生成时间：${new Date().toLocaleString('zh-CN')} | 生成人：${user?.display_name || user?.username || 'System'}*`;
  
  // 9. 保存到数据库
  await saveReport({
    appId,
    appName,
    reportType: 'weekly',
    weekNumber,
    year,
    title,
    content: fullReport,
    summaryStats: overview.categories,
    comparedWithLast: comparison,
    totalIssues: overview.total,
    newIssues: overview.total,
    resolvedIssues: resolved.length,
    pendingIssues: overview.total - overview.processed,
    clusterSummary: JSON.stringify(clusterResult.clusters || []),
    actionItems: JSON.stringify([]) // 可以后续从AI结果中提取
  }, user);
  
  console.log('[WeeklyReport] 报告生成完成');
  
  return {
    success: true,
    report: fullReport,
    meta: {
      appId,
      appName,
      weekNumber,
      year,
      dateRange: `${thisWeek.start} ~ ${thisWeek.end}`,
      totalAnalyzed: overview.total,
      clustersFound: clusterResult.clusters?.length || 0
    }
  };
}

export default { generateWeeklyReport };