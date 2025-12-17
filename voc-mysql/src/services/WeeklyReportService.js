/**
 * WeeklyReportService.js
 * 功能4: 周度自动报告
 * 
 * 整合功能1-3的结果，生成结构化周报
 */

import pool from '../db.js';
import { recordAICost } from '../db.js';
import { loadAllReports, filterData } from './dataLoader.js';
import { getLatestClusterSummary } from './ClusterService.js';
import { getVerificationSummary } from './VerificationService.js';
import { getTopicAnalysisHistory, getTopics } from './TopicService.js';
import { getStatusBatch, saveReport, getLastReport, ACTIVE_STATUSES } from '../db.js';
import OpenAI from 'openai';

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

function getWeekInfo(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { weekNumber, year: d.getUTCFullYear() };
}

/**
 * 收集周报所需的所有数据
 */
async function collectReportData(appId) {
  const { weekNumber, year } = getWeekInfo();
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // 1. 加载基础数据
  const result = await loadAllReports();
  let allData = result.data.filter(item => item.appId === appId);
  const allIds = allData.map(d => d.id).filter(Boolean);
  const statusMap = await getStatusBatch(allIds);
  
  allData = allData.map(item => ({
    ...item,
    status: statusMap[item.id]?.status || 'pending'
  }));
  
  // 2. 基础统计
  const activeItems = allData.filter(item => ACTIVE_STATUSES.includes(item.status));
  const newThisWeek = activeItems.filter(item => new Date(item.date) >= oneWeekAgo);
  const resolvedItems = allData.filter(item => item.status === 'resolved');
  
  // 按分类统计
  const categoryStats = {};
  activeItems.forEach(item => {
    const cat = item.category || 'Other';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  });
  
  // 按风险统计
  const riskStats = { High: 0, Medium: 0, Low: 0 };
  activeItems.forEach(item => {
    const risk = item.risk_level || 'Medium';
    if (riskStats[risk] !== undefined) riskStats[risk]++;
  });
  
  // 3. 获取聚类结果
  const clusterSummary = await getLatestClusterSummary(appId);
  
  // 4. 获取专题追踪结果
  const topics = await getTopics({ appId, isActive: true });
  const topicResults = [];
  for (const topic of topics.slice(0, 5)) {
    const history = await getTopicAnalysisHistory(topic.id, 1);
    if (history.length > 0) {
      topicResults.push({
        name: topic.name,
        totalMatches: history[0].total_matches,
        sentiment: {
          positive: history[0].sentiment_positive,
          negative: history[0].sentiment_negative,
          neutral: history[0].sentiment_neutral
        },
        summary: history[0].ai_summary,
        painPoints: history[0].pain_points
      });
    }
  }
  
  // 5. 获取闭环验证结果
  const verificationResults = await getVerificationSummary(appId);
  
  // 6. 获取上周对比
  const lastReport = await getLastReport(appId);
  let weekComparison = null;
  if (lastReport) {
    weekComparison = {
      lastPending: lastReport.pending_issues,
      lastNew: lastReport.new_issues,
      lastResolved: lastReport.resolved_issues,
      changePercent: lastReport.pending_issues > 0 
        ? Math.round(((activeItems.length - lastReport.pending_issues) / lastReport.pending_issues) * 100)
        : 0
    };
  }
  
  return {
    weekNumber,
    year,
    overview: {
      totalActive: activeItems.length,
      newThisWeek: newThisWeek.length,
      resolved: resolvedItems.length,
      categoryStats,
      riskStats
    },
    clusters: clusterSummary,
    topics: topicResults,
    verifications: verificationResults,
    comparison: weekComparison,
    highPriorityItems: activeItems
      .filter(item => item.risk_level === 'High')
      .slice(0, 10)
      .map(item => ({
        summary: item.summary,
        category: item.category,
        rootCause: item.root_cause,
        suggestion: item.action_advice
      }))
  };
}

/**
 * 生成结构化周报 JSON
 */
export async function generateStructuredReport(appId, user = null) {
  const data = await collectReportData(appId);
  const result = await loadAllReports();
  const appInfo = result.data.find(d => d.appId === appId);
  const appName = appInfo?.appName || appId;
  
  // 构建结构化报告
  const structuredReport = {
    meta: {
      appId,
      appName,
      weekNumber: data.weekNumber,
      year: data.year,
      generatedAt: new Date().toISOString(),
      generatedBy: user?.display_name || user?.username || 'system'
    },
    
    // 1. 概览
    overview: {
      totalActive: data.overview.totalActive,
      newThisWeek: data.overview.newThisWeek,
      resolved: data.overview.resolved,
      riskDistribution: data.overview.riskStats,
      categoryDistribution: data.overview.categoryStats,
      weekOverWeek: data.comparison ? {
        pendingChange: data.overview.totalActive - data.comparison.lastPending,
        changePercent: data.comparison.changePercent,
        trend: data.comparison.changePercent > 10 ? 'worsening' : 
               data.comparison.changePercent < -10 ? 'improving' : 'stable'
      } : null
    },
    
    // 2. Top 痛点榜（聚类结果）
    topPainPoints: data.clusters?.byCategory || {},
    
    // 3. 专题追踪
    topicTracking: data.topics.map(t => ({
      name: t.name,
      matches: t.totalMatches,
      sentimentSummary: t.sentiment.positive > t.sentiment.negative 
        ? `正面 ${Math.round(t.sentiment.positive / (t.totalMatches || 1) * 100)}%`
        : `负面 ${Math.round(t.sentiment.negative / (t.totalMatches || 1) * 100)}%`,
      summary: t.summary
    })),
    
    // 4. 闭环验证结果
    verificationResults: data.verifications.map(v => ({
      issue: v.issueValue,
      optimization: v.optimization,
      result: v.conclusionText,
      status: v.status
    })),
    
    // 5. 高优先级问题
    highPriorityIssues: data.highPriorityItems
  };
  
  return structuredReport;
}

/**
 * 生成 AI 总结的周报（Markdown 格式）
 */
export async function generateAIWeeklyReport(appId, user = null) {
  const structuredData = await generateStructuredReport(appId, user);
  
  const client = getAIClient();
  const isQwen = !!process.env.TONGYI_API_KEY;
  const model = isQwen ? 'qwen3-max' : 'deepseek-chat';
  
  const prompt = `你是金融科技产品运营专家，请基于以下结构化数据生成一份简洁、可执行的周报。

## 数据
${JSON.stringify(structuredData, null, 2)}

## 报告要求
1. **不要写标题和时间**（系统会自动添加）
2. 使用 Markdown 格式，禁止表格
3. 结构如下：
   - 📊 本周概览（3-5个关键指标）
   - 🔥 Top 痛点榜（引用聚类结果，每个痛点1-2行）
   - 📌 专题追踪（引用专题分析，简洁）
   - ✅ 闭环验证（引用验证结果）
   - 💡 下周行动建议（3-5条可执行建议）

## 风格
- 直接、简洁
- 用数据说话
- 给出具体可执行的建议`;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 3000,
    temperature: 0.3,
    messages: [
      { role: 'system', content: '你是VOC周报专家，生成简洁可执行的周报。用中文回复。' },
      { role: 'user', content: prompt }
    ]
  });

  if (completion.usage) {
    await recordAICost(isQwen ? 'qwen' : 'deepseek', model, 'weekly_report', completion.usage);
  }

  let report = completion.choices[0].message.content.trim();
  
  // 添加标题
  const title = `${structuredData.meta.appName} GP VOC 周报 ${structuredData.meta.year} W${structuredData.meta.weekNumber}`;
  report = `# ${title}\n\n${report}`;
  
  // 添加生成信息
  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  report += `\n\n---\n*报告生成时间：${currentDate} | 生成人：${structuredData.meta.generatedBy}*`;
  
  // 保存到数据库
  await saveReport({
    appId,
    appName: structuredData.meta.appName,
    reportType: 'weekly',
    weekNumber: structuredData.meta.weekNumber,
    year: structuredData.meta.year,
    title,
    content: report,
    summaryStats: structuredData.overview.categoryDistribution,
    comparedWithLast: structuredData.overview.weekOverWeek,
    totalIssues: structuredData.overview.totalActive + structuredData.overview.resolved,
    newIssues: structuredData.overview.newThisWeek,
    resolvedIssues: structuredData.overview.resolved,
    pendingIssues: structuredData.overview.totalActive,
    // 新增字段
    clusterSummary: JSON.stringify(structuredData.topPainPoints),
    topicSummary: JSON.stringify(structuredData.topicTracking),
    verificationSummary: JSON.stringify(structuredData.verificationResults)
  }, user);
  
  return {
    success: true,
    report,
    structured: structuredData,
    meta: structuredData.meta
  };
}

/**
 * 定时任务入口：生成所有 App 的周报
 */
export async function generateAllWeeklyReports(user = null) {
  const result = await loadAllReports();
  const allData = result.data;
  const appIds = [...new Set(allData.map(d => d.appId).filter(Boolean))];
  
  const results = [];
  
  for (const appId of appIds) {
    try {
      console.log(`[WeeklyReport] 生成 ${appId}...`);
      const result = await generateAIWeeklyReport(appId, user);
      results.push({ appId, success: true, ...result.meta });
    } catch (e) {
      console.error(`[WeeklyReport] ${appId} 失败:`, e.message);
      results.push({ appId, success: false, error: e.message });
    }
  }
  
  return {
    total: appIds.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

export default {
  collectReportData,
  generateStructuredReport,
  generateAIWeeklyReport,
  generateAllWeeklyReports
};