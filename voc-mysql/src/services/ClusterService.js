/**
 * ClusterService.js
 * 功能1: 用户原声智能聚类
 * 
 * 职责:
 * 1. 按分类聚合本周评论
 * 2. 调用 AI 进行二次聚类分析
 * 3. 存储聚类结果
 */

import pool from '../db.js';
import { recordAICost } from '../db.js';
import { loadAllReports } from './dataLoader.js';
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

/**
 * 获取当前周数和年份
 */
function getWeekInfo(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { weekNumber, year: d.getUTCFullYear() };
}

/**
 * 获取本周日期范围
 */
function getWeekDateRange(weekNumber, year) {
  // 计算该年第一天
  const jan1 = new Date(year, 0, 1);
  // 计算第一周的周一
  const firstMonday = new Date(jan1);
  const day = jan1.getDay() || 7;
  firstMonday.setDate(jan1.getDate() + (day <= 4 ? 1 - day : 8 - day));
  
  // 计算目标周的起止日期
  const start = new Date(firstMonday);
  start.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * 按分类筛选本周评论
 */
export async function getWeeklyReviewsByCategory(appId, category, weekNumber, year) {
  const { start, end } = getWeekDateRange(weekNumber, year);
  
  // 从内存数据中筛选
  const allData = loadAllReports();
  
  return allData.filter(item => {
    if (item.appId !== appId) return false;
    if (item.category !== category) return false;
    
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
}

/**
 * AI 聚类分析
 * 将同类问题的 root_cause 进行聚类，提炼 Top N 痛点
 */
export async function clusterReviewsWithAI(reviews, topN = 5) {
  if (reviews.length === 0) {
    return { clusters: [], totalAnalyzed: 0 };
  }
  
  const client = getAIClient();
  const isQwen = !!process.env.TONGYI_API_KEY;
  const model = isQwen ? 'qwen3-max' : 'deepseek-chat';
  
  // 准备输入数据：提取关键字段
  const inputData = reviews.map(r => ({
    id: r.id,
    summary: r.summary,
    root_cause: r.root_cause || r.summary,
    translated_text: (r.translated_text || '').substring(0, 200)
  }));
  
  const prompt = `你是一位资深的用户研究专家。请对以下 ${reviews.length} 条同类用户反馈进行聚类分析。

## 任务
1. 分析所有评论的 root_cause 和 summary
2. 将相似问题归类，提炼出 Top ${topN} 个具体痛点
3. 每个痛点需要：
   - 一个简洁的标题（如"短信验证码收不到"、"人脸识别闪退"）
   - 涉及的评论ID列表
   - 代表性的用户原话

## 输入数据
${JSON.stringify(inputData, null, 2)}

## 输出格式（严格JSON）
{
  "clusters": [
    {
      "rank": 1,
      "title": "痛点标题",
      "count": 涉及评论数,
      "percentage": 占比百分比(数字),
      "reviewIds": ["id1", "id2"],
      "rootCauseSummary": "根因汇总",
      "sampleQuotes": ["用户原话1", "用户原话2"],
      "actionSuggestion": "建议的改进措施"
    }
  ],
  "uncategorized": 无法归类的数量
}`;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 3000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是VOC分析专家，擅长从大量用户反馈中提炼核心痛点。请用中文回复，严格返回JSON。' },
      { role: 'user', content: prompt }
    ]
  });

  if (completion.usage) {
    await recordAICost(isQwen ? 'qwen' : 'deepseek', model, 'clustering', completion.usage);
  }

  try {
    const result = JSON.parse(completion.choices[0].message.content);
    return {
      clusters: result.clusters || [],
      uncategorized: result.uncategorized || 0,
      totalAnalyzed: reviews.length
    };
  } catch (e) {
    console.error('[Cluster] AI 返回解析失败:', e);
    return { clusters: [], totalAnalyzed: reviews.length, error: e.message };
  }
}

/**
 * 执行聚类分析并保存结果
 */
export async function runClusteringForApp(appId, category, options = {}) {
  const { weekNumber, year } = options.weekNumber 
    ? options 
    : getWeekInfo();
  
  const { start, end } = getWeekDateRange(weekNumber, year);
  
  console.log(`[Cluster] 开始聚类: ${appId} / ${category} / ${year}W${weekNumber}`);
  
  // 获取本周该分类的评论
  const reviews = await getWeeklyReviewsByCategory(appId, category, weekNumber, year);
  
  if (reviews.length < 3) {
    console.log(`[Cluster] 评论数不足(${reviews.length})，跳过聚类`);
    return { success: true, skipped: true, reason: 'insufficient_data', count: reviews.length };
  }
  
  // AI 聚类
  const { clusters, totalAnalyzed, error } = await clusterReviewsWithAI(reviews);
  
  if (error) {
    return { success: false, error };
  }
  
  // 保存到数据库
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 先删除旧数据
    await conn.execute(
      'DELETE FROM issue_clusters WHERE app_id = ? AND category = ? AND week_number = ? AND year = ?',
      [appId, category, weekNumber, year]
    );
    
    // 插入新聚类结果
    for (const cluster of clusters) {
      await conn.execute(
        `INSERT INTO issue_clusters 
         (app_id, category, week_number, year, period_start, period_end,
          cluster_title, cluster_rank, review_count, percentage,
          review_ids, root_cause_summary, action_suggestion, sample_reviews)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appId, category, weekNumber, year,
          start.toISOString().split('T')[0],
          end.toISOString().split('T')[0],
          cluster.title,
          cluster.rank,
          cluster.count,
          cluster.percentage,
          JSON.stringify(cluster.reviewIds),
          cluster.rootCauseSummary,
          cluster.actionSuggestion,
          JSON.stringify(cluster.sampleQuotes)
        ]
      );
    }
    
    await conn.commit();
    console.log(`[Cluster] 保存完成: ${clusters.length} 个聚类`);
    
    return {
      success: true,
      totalAnalyzed,
      clustersCreated: clusters.length,
      clusters
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 批量执行聚类（所有App的所有需关注分类）
 */
export async function runWeeklyClustering() {
  const CATEGORIES_TO_CLUSTER = ['Tech_Bug', 'Compliance_Risk', 'Product_Issue'];
  const { weekNumber, year } = getWeekInfo();
  
  // 获取所有 App
  const allData = loadAllReports();
  const appIds = [...new Set(allData.map(d => d.appId).filter(Boolean))];
  
  const results = [];
  
  for (const appId of appIds) {
    for (const category of CATEGORIES_TO_CLUSTER) {
      try {
        const result = await runClusteringForApp(appId, category, { weekNumber, year });
        results.push({ appId, category, ...result });
      } catch (e) {
        console.error(`[Cluster] ${appId}/${category} 失败:`, e.message);
        results.push({ appId, category, success: false, error: e.message });
      }
    }
  }
  
  return {
    weekNumber,
    year,
    results,
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      skipped: results.filter(r => r.skipped).length
    }
  };
}

/**
 * 获取聚类结果
 */
export async function getClusters(filters = {}) {
  const { appId, category, weekNumber, year } = filters;
  
  let sql = 'SELECT * FROM issue_clusters WHERE 1=1';
  const params = [];
  
  if (appId) { sql += ' AND app_id = ?'; params.push(appId); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (weekNumber) { sql += ' AND week_number = ?'; params.push(weekNumber); }
  if (year) { sql += ' AND year = ?'; params.push(year); }
  
  sql += ' ORDER BY year DESC, week_number DESC, cluster_rank ASC';
  
  const [rows] = await pool.execute(sql, params);
  
  return rows.map(row => ({
    ...row,
    review_ids: typeof row.review_ids === 'string' ? JSON.parse(row.review_ids) : row.review_ids,
    sample_reviews: typeof row.sample_reviews === 'string' ? JSON.parse(row.sample_reviews) : row.sample_reviews
  }));
}

/**
 * 获取最新一周的聚类摘要（用于周报）
 */
export async function getLatestClusterSummary(appId) {
  const { weekNumber, year } = getWeekInfo();
  
  const clusters = await getClusters({ appId, weekNumber, year });
  
  // 按分类分组
  const grouped = {};
  clusters.forEach(c => {
    if (!grouped[c.category]) {
      grouped[c.category] = [];
    }
    grouped[c.category].push({
      rank: c.cluster_rank,
      title: c.cluster_title,
      count: c.review_count,
      percentage: c.percentage,
      rootCause: c.root_cause_summary,
      suggestion: c.action_suggestion
    });
  });
  
  return {
    weekNumber,
    year,
    byCategory: grouped
  };
}

export default {
  getWeekInfo,
  getWeekDateRange,
  getWeeklyReviewsByCategory,
  clusterReviewsWithAI,
  runClusteringForApp,
  runWeeklyClustering,
  getClusters,
  getLatestClusterSummary
};
