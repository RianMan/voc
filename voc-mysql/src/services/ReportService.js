import OpenAI from 'openai';
import { loadAllReports, filterData } from './dataLoader.js';
import { 
  saveReport, 
  getLastReport, 
  ACTIVE_STATUSES,
  getStatusBatch,
  recordAICost,
  getWeeklyStatusLogs
} from '../db/index.js';

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

// 按操作人汇总处理记录
function summarizeByOperator(logs) {
  const summary = {};
  
  logs.forEach(log => {
    const operator = log.user_name || 'system';
    if (!summary[operator]) {
      summary[operator] = {
        name: operator,
        resolved: 0,
        confirmed: 0,
        reported: 0,
        in_progress: 0,
        irrelevant: 0,
        total: 0,
        actions: []
      };
    }
    
    summary[operator].total++;
    if (log.new_status === 'resolved') summary[operator].resolved++;
    if (log.new_status === 'confirmed') summary[operator].confirmed++;
    if (log.new_status === 'reported') summary[operator].reported++;
    if (log.new_status === 'in_progress') summary[operator].in_progress++;
    if (log.new_status === 'irrelevant') summary[operator].irrelevant++;
    
    summary[operator].actions.push({
      reviewId: log.review_id,
      oldStatus: log.old_status,
      newStatus: log.new_status,
      note: log.note,
      time: log.created_at
    });
  });
  
  return Object.values(summary).sort((a, b) => b.total - a.total);
}

const REPORT_PROMPT = `你是一个专业的金融科技产品运营专家。你的任务是基于详细的数据分析字段（如根本原因、行动建议），生成一份**深度复盘**风格的周报。

## 输出要求
1. **严禁生成标题**。
2. **严禁生成时间**。
3. **禁止表格**，使用清晰的 Markdown 列表。
4. 语言风格：专业、犀利、直接。拒绝正确的废话。

## 报告结构

### 1. 本周概览
- 核心指标（待处理/新增/已解决）
- **风险态势**：一句话总结本周的核心痛点（如：本周产品类投诉激增，主要集中在下单流程误解）。

### 2. 本周处理记录 ⭐
(按处理人汇总)

### 3. 问题状态/分类分布
(中文状态，过滤掉好评的分类)

### 4. 高优先级问题深度剖析（核心价值版块）
请直接引用 JSON 数据中的分析结论，不要自己瞎编。格式如下：
- **🔴 问题**：[summary]
- **🕒 时间**：YYYY-MM-DD (遗留：是/否)
- **🧠 归因**：[rootCause] (这是关键，直接展示数据中的归因)
- **🔧 建议**：[actionAdvice] (这是关键，直接展示数据中的建议)
- **💬 待回复**：(仅当未回复时展示 suggestedReply)

### 5. 本周 vs 上周对比
(简要)

### 6. 总结与行动计划
- **紧急阻断**：针对合规风险的措施。
- **产品/体验优化**：基于上面的"归因"和"建议"，制定本周的产品优化计划（例如：优化下单页UI、修改短信文案）。
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
 * 准备单个App的报告数据（异步版本）
 */
async function prepareAppReportData(items, lastReport) {
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
      isLegacy: new Date(item.date) < twoWeeksAgo,
      hasReply: !!item.replyText,
      rootCause: item.root_cause || "AI未归因",
      actionAdvice: item.action_advice || "建议人工复核",
      suggestedReply: item.suggested_reply || "Please contact support."
    }));

  // 获取本周操作记录（异步）
  const allIds = items.map(i => i.id);
  const weeklyLogs = await getWeeklyStatusLogs(allIds, 7);
  const operatorSummary = summarizeByOperator(weeklyLogs);

  // 本周解决的问题详情
  const resolvedThisWeek = weeklyLogs
    .filter(log => log.new_status === 'resolved')
    .map(log => {
      const item = items.find(i => i.id === log.review_id);
      return {
        summary: item?.summary || log.review_id,
        operator: log.user_name || 'system',
        time: log.created_at,
        note: log.note
      };
    });

  // 上周对比数据
  let comparison = null;
  if (lastReport) {
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
    resolvedThisWeekCount: resolvedThisWeek.length,
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
    operatorSummary,
    resolvedThisWeek: resolvedThisWeek.slice(0, 20),
    weeklyLogsCount: weeklyLogs.length,
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
 * 为单个App生成报告（异步版本）
 */
export async function generateAppReport(appId, appName, items, options = {}, user = null) {
  const { save = true } = options;
  
  // 获取上期报告用于对比
  const lastReport = await getLastReport(appId);
  
  // 准备数据
  const reportData = await prepareAppReportData(items, lastReport);
  
  if (reportData.totalActive === 0 && reportData.resolvedThisWeekCount === 0) {
    return {
      success: true,
      report: `## ${appName} 周报\n\n✅ 本周无待处理问题，保持良好！`,
      meta: { appId, appName, totalAnalyzed: 0 }
    };
  }

  const client = getClient();

  const isQwen = !!process.env.TONGYI_API_KEY;
  const provider = isQwen ? 'qwen' : 'deepseek';
  const model = isQwen ? 'qwen3-max' : 'deepseek-chat';

  const weekNum = getWeekNumber();
  const year = new Date().getFullYear();

  // 构建处理记录文本
  let operatorText = '暂无本周处理记录';
  if (reportData.operatorSummary.length > 0) {
    operatorText = reportData.operatorSummary.map(op => {
      let actions = [];
      if (op.resolved > 0) actions.push(`解决 ${op.resolved} 条`);
      if (op.confirmed > 0) actions.push(`确认 ${op.confirmed} 条`);
      if (op.reported > 0) actions.push(`反馈 ${op.reported} 条`);
      if (op.in_progress > 0) actions.push(`处理中 ${op.in_progress} 条`);
      if (op.irrelevant > 0) actions.push(`标记无效 ${op.irrelevant} 条`);
      return `- ${op.name}: ${actions.join(', ')} (共 ${op.total} 次操作)`;
    }).join('\n');
  }

  // 构建已解决问题详情
  let resolvedDetailText = '无';
  if (reportData.resolvedThisWeek.length > 0) {
    resolvedDetailText = reportData.resolvedThisWeek.map(r => {
      const time = new Date(r.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `- ${r.operator}: "${r.summary}" (${time})${r.note ? ` - 备注: ${r.note}` : ''}`;
    }).join('\n');
  }

  const filteredCategoryStats = { ...reportData.categoryStats };
  delete filteredCategoryStats['Positive'];
  delete filteredCategoryStats['Other'];
  delete filteredCategoryStats['positive'];
  delete filteredCategoryStats['other'];

  const userPrompt = `请为 **${appName}** 生成 ${year}年 第 ${weekNum} 周的VOC分析周报。

    ## 数据摘要
    - 待处理：${reportData.totalActive}
    - 新增：${reportData.newThisWeek}
    - 遗留 >2周：${reportData.legacyCount}

    ## 统计
    - 状态：${JSON.stringify(reportData.statusBreakdown)}
    - 分类：${JSON.stringify(filteredCategoryStats)}
    - 风险：${JSON.stringify(reportData.riskStats)}

    ## 高优先级问题清单 (包含深度分析数据)
    注意：
    1. 请重点展示 'rootCause'(根本原因) 和 'actionAdvice'(行动建议) 字段。
    2. 如果 'hasReply' 为 false，请展示 'suggestedReply'。
    
    ${JSON.stringify(reportData.highPriorityIssues, null, 2)}

    ## 处理记录 & 解决详情
    ${operatorText}
    ${resolvedDetailText}

    ${reportData.comparison ? `## 对比：待处理变化 ${reportData.comparison.changePercent}%` : '首次生成'}

    请生成周报。重点：**把每一条高危问题都当做一个产品需求单来写，分析原因并给出方案。**
    `;

  const completion = await client.chat.completions.create({
    model: model,
    max_tokens: 4000,
    temperature: 0.3,
    messages: [
      { role: 'system', content: REPORT_PROMPT },
      { role: 'user', content: userPrompt }
    ]
  });

  if (completion.usage) {
      await recordAICost(provider, model, 'report', completion.usage);
  }

  let report = completion.choices[0].message.content.trim();

  report = report.replace(/^#\s+.*?\n+/, '');
  
  // 添加报告头部
  const title = `${appName} GP VOC 周报 ${year} W${weekNum}`;
  report = `# ${title}\n\n${report}`;
  
  // 添加元信息
  const currentDate = getCurrentDate();
  const generatorName = user?.display_name || user?.username || user?.name || '管理员'; 
  
  report += `\n\n---\n*报告生成时间：${currentDate} | 生成人：${generatorName}*`;

  // 保存到数据库
  if (save) {
    await saveReport({
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
      resolvedIssues: reportData.resolvedThisWeekCount,
      pendingIssues: reportData.totalActive
    }, user);
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
      resolved: reportData.resolvedThisWeekCount,
      generatedBy: generatorName,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * 为所有App批量生成报告
 */
export async function generateAllAppReports(user = null) {
  const result = await loadAllReports();
  let data = result.data;
  
  // 获取状态
  const allIds = data.map(d => d.id).filter(Boolean);
  const statusMap = await getStatusBatch(allIds);
  data = data.map(item => ({
    ...item,
    status: statusMap[item.id]?.status || 'pending'
  }));

  const appGroups = groupDataByApp(data);
  const results = [];

  for (const [appId, group] of Object.entries(appGroups)) {
    try {
      console.log(`[Report] Generating for ${group.appName}...`);
      const result = await generateAppReport(appId, group.appName, group.items, {}, user);
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
export async function generateReportForApp(appId, filters = {}, limit = 200, user = null) {
  const result = await loadAllReports();
  let data = result.data;
  
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
  const statusMap = await getStatusBatch(allIds);
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
  return generateAppReport(appId, appName, data.slice(0, limit), {}, user);
}