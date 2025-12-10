import OpenAI from 'openai';
import { loadAllReports, filterData } from './dataLoader.js';
import { 
  saveReport, 
  getLastReport, 
  ACTIVE_STATUSES,
  getStatusBatch 
} from '../db.js';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.TONGYI_API_KEY || process.env.DEEPSEEK_API_KEY;
    const baseURL = process.env.TONGYI_API_KEY 
      ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      : (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');

    if (!apiKey) {
      throw new Error('请在 .env 中设置 TONGYI_API_KEY 或 DEEPSEEK_API_KEY');
    }

    client = new OpenAI({ apiKey, baseURL });
  }
  return client;
}

// 获取当前周数
function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getCurrentDate() {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

const REPORT_PROMPT = `你是一个专业的金融科技产品运营分析师，负责分析用户反馈(VOC)数据并生成周报。

## 输出要求
1. 使用中文撰写
2. 使用 Markdown 格式
3. **禁止使用表格**，改用列表形式展示数据
4. 结构清晰，重点突出
5. **不要在报告中写生成时间**，系统会自动添加

## 报告结构

### 1. 本周概览
- 本周待处理问题总数
- 新增问题数（相比上周）
- 已解决问题数
- 处理率（已解决/上周遗留+本周新增）

### 2. 问题状态分布
- 待处理：X条
- 已确认：X条
- 处理中：X条
- 已反馈：X条

### 3. 问题分类统计
按 Tech_Bug / Compliance_Risk / Product_Issue 等分类统计

### 4. 高优先级问题（需立即处理）
列出 High 风险且未解决的问题，标注：
- 问题摘要
- 首次出现时间
- 是否为遗留问题（连续出现2周以上标红）

### 5. 本周 vs 上周对比
- 新增问题趋势（增加/减少 X%）
- 各分类变化情况
- 处理效率变化

### 6. 行动建议
- 紧急（24小时内）
- 本周内
- 持续关注

## 风格
- 简洁、可执行
- 高风险项用 **加粗** 或 🔴 标注
- 遗留超过2周的问题用 ⚠️ 标注
`;

/**
 * 按App分组数据
 */
export function groupDataByApp(data) {
  const groups = {};
  data.forEach(item => {
    const appId = item.appId || 'unknown';
    if (!groups[appId]) {
      groups[appId] = {
        appId,
        appName: item.appName || appId,
        country: item.country || 'Unknown',
        items: []
      };
    }
    groups[appId].items.push(item);
  });
  return groups;
}

/**
 * 准备单个App的报告数据
 */
function prepareAppReportData(items, lastReport) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 按状态分类
  const byStatus = {
    pending: [],
    confirmed: [],
    reported: [],
    in_progress: [],
    resolved: [],
    irrelevant: []
  };

  items.forEach(item => {
    const status = item.status || 'pending';
    if (byStatus[status]) {
      byStatus[status].push(item);
    }
  });

  // 活跃问题（排除已解决和无意义）
  const activeItems = items.filter(item => 
    ACTIVE_STATUSES.includes(item.status || 'pending')
  );

  // 本周新增（基于date字段）
  const newThisWeek = activeItems.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= oneWeekAgo;
  });

  // 遗留问题（超过2周未解决）
  const legacyIssues = activeItems.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate < twoWeeksAgo;
  });

  // 按分类统计
  const categoryStats = {};
  activeItems.forEach(item => {
    const cat = item.category || 'Other';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  });

  // 按风险统计
  const riskStats = { High: 0, Medium: 0, Low: 0 };
  activeItems.forEach(item => {
    const risk = item.risk_level || item.riskLevel || 'Medium';
    if (riskStats[risk] !== undefined) riskStats[risk]++;
  });

  // 高优先级问题
  const highPriorityIssues = activeItems
    .filter(item => (item.risk_level || item.riskLevel) === 'High')
    .map(item => ({
      id: item.id,
      summary: item.summary,
      category: item.category,
      date: item.date,
      status: item.status || 'pending',
      isLegacy: new Date(item.date) < twoWeeksAgo
    }));

  // 上周对比数据
  let comparison = null;
  if (lastReport) {
    const lastStats = JSON.parse(lastReport.summary_stats || '{}');
    comparison = {
      lastWeekTotal: lastReport.pending_issues || 0,
      lastWeekNew: lastReport.new_issues || 0,
      lastWeekResolved: lastReport.resolved_issues || 0,
      changePercent: lastReport.pending_issues > 0 
        ? Math.round(((activeItems.length - lastReport.pending_issues) / lastReport.pending_issues) * 100)
        : 0
    };
  }

  return {
    totalActive: activeItems.length,
    newThisWeek: newThisWeek.length,
    resolvedCount: byStatus.resolved.length,
    legacyCount: legacyIssues.length,
    statusBreakdown: {
      pending: byStatus.pending.length,
      confirmed: byStatus.confirmed.length,
      reported: byStatus.reported.length,
      in_progress: byStatus.in_progress.length
    },
    categoryStats,
    riskStats,
    highPriorityIssues: highPriorityIssues.slice(0, 15),
    legacyIssues: legacyIssues.slice(0, 10).map(i => ({
      summary: i.summary,
      date: i.date,
      category: i.category
    })),
    comparison,
    // 用于存档
    allActiveItems: activeItems.slice(0, 50).map(i => ({
      id: i.id,
      summary: i.summary,
      category: i.category,
      risk: i.risk_level || i.riskLevel,
      status: i.status
    }))
  };
}

/**
 * 为单个App生成报告
 */
export async function generateAppReport(appId, appName, items, options = {}) {
  const { save = true } = options;
  
  // 获取上期报告用于对比
  const lastReport = getLastReport(appId);
  
  // 准备数据
  const reportData = prepareAppReportData(items, lastReport);
  
  if (reportData.totalActive === 0) {
    return {
      success: true,
      report: `## ${appName} 周报\n\n✅ 本周无待处理问题，保持良好！`,
      meta: { appId, appName, totalAnalyzed: 0 }
    };
  }

  const client = getClient();
  const weekNum = getWeekNumber();
  const year = new Date().getFullYear();

  const userPrompt = `请为 **${appName}** 生成第 ${weekNum} 周的VOC分析周报。

## 数据摘要
- 当前待处理问题：${reportData.totalActive} 条
- 本周新增：${reportData.newThisWeek} 条
- 本周已解决：${reportData.resolvedCount} 条
- 遗留超过2周：${reportData.legacyCount} 条

## 状态分布
- 待处理：${reportData.statusBreakdown.pending}
- 已确认：${reportData.statusBreakdown.confirmed}
- 已反馈：${reportData.statusBreakdown.reported}
- 处理中：${reportData.statusBreakdown.in_progress}

## 问题分类
${JSON.stringify(reportData.categoryStats)}

## 风险分布
${JSON.stringify(reportData.riskStats)}

## 高优先级问题
${JSON.stringify(reportData.highPriorityIssues, null, 2)}

## 遗留问题（超过2周）
${JSON.stringify(reportData.legacyIssues, null, 2)}

${reportData.comparison ? `
## 与上周对比
- 上周待处理：${reportData.comparison.lastWeekTotal} 条
- 上周新增：${reportData.comparison.lastWeekNew} 条
- 上周解决：${reportData.comparison.lastWeekResolved} 条
- 变化：${reportData.comparison.changePercent > 0 ? '+' : ''}${reportData.comparison.changePercent}%
` : '## 上周对比\n首次生成报告，无历史数据对比'}

请生成完整的周报：`;

  const completion = await client.chat.completions.create({
    model: process.env.TONGYI_API_KEY ? 'qwen3-max' : 'deepseek-chat',
    max_tokens: 4000,
    temperature: 0.3,
    messages: [
      { role: 'system', content: REPORT_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  });

  let report = completion.choices[0].message.content.trim();
  
  // 添加报告头部
  const title = `${appName} GP VOC 周报 W${weekNum}`;
  report = `# ${title}\n\n${report}`;
  
  // 添加元信息
  const currentDate = getCurrentDate();
  report += `\n\n---\n*报告生成时间：${currentDate}*`;

  // 保存到数据库
  if (save) {
    saveReport({
      appId,
      appName,
      reportType: 'weekly',
      weekNumber: weekNum,
      year,
      title,
      content: report,
      summaryStats: reportData.categoryStats,
      comparedWithLast: reportData.comparison,
      totalIssues: items.length,
      newIssues: reportData.newThisWeek,
      resolvedIssues: reportData.resolvedCount,
      pendingIssues: reportData.totalActive
    });
  }

  return {
    success: true,
    report,
    meta: {
      appId,
      appName,
      weekNumber: weekNum,
      year,
      totalAnalyzed: reportData.totalActive,
      newThisWeek: reportData.newThisWeek,
      resolved: reportData.resolvedCount,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 为所有App批量生成报告
 */
export async function generateAllAppReports() {
  let data = loadAllReports();
  
  // 获取状态
  const allIds = data.map(d => d.id).filter(Boolean);
  const statusMap = getStatusBatch(allIds);
  data = data.map(item => ({
    ...item,
    status: statusMap[item.id]?.status || 'pending'
  }));

  const appGroups = groupDataByApp(data);
  const results = [];

  for (const [appId, group] of Object.entries(appGroups)) {
    try {
      console.log(`[Report] Generating for ${group.appName}...`);
      const result = await generateAppReport(appId, group.appName, group.items);
      results.push(result);
    } catch (e) {
      console.error(`[Report] Failed for ${appId}:`, e.message);
      results.push({
        success: false,
        appId,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * 为指定App生成报告（供API调用）
 */
export async function generateReportForApp(appId, filters = {}, limit = 200) {
  let data = loadAllReports();
  
  // 筛选指定App
  data = data.filter(item => item.appId === appId);
  
  if (data.length === 0) {
    return {
      success: false,
      error: `No data found for app: ${appId}`
    };
  }

  // 获取状态
  const allIds = data.map(d => d.id).filter(Boolean);
  const statusMap = getStatusBatch(allIds);
  data = data.map(item => ({
    ...item,
    status: statusMap[item.id]?.status || 'pending'
  }));

  // 应用其他筛选
  if (filters.category && filters.category !== 'All') {
    data = data.filter(item => item.category === filters.category);
  }
  if (filters.risk && filters.risk !== 'All') {
    data = data.filter(item => (item.risk_level || item.riskLevel) === filters.risk);
  }

  const appName = data[0]?.appName || appId;
  return generateAppReport(appId, appName, data.slice(0, limit));
}
