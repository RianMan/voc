/**
 * TopicService.js
 * 功能2: 定向专题分析服务
 * 
 * 职责:
 * 1. 专题配置 CRUD
 * 2. 关键词匹配扫描
 * 3. AI 专项分析
 */

import pool from '../db.js';
import { recordAICost } from '../db.js';
import OpenAI from 'openai';

// AI 客户端（延迟初始化）
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

// ==================== 专题配置 CRUD ====================

/**
 * 创建专题配置
 */
export async function createTopic(data) {
  const { name, description, keywords, scope, country, appId, startDate, endDate, createdBy } = data;
   // appId 必填
  if (!appId) {
    throw new Error('必须选择App');
  }
  // 校验作用域
  if (scope === 'country' && !country) {
    throw new Error('scope=country 时必须指定 country');
  }
  // if (scope === 'app' && (!country || !appId)) {
  //   throw new Error('scope=app 时必须指定 country 和 appId');
  // }
  
  const [result] = await pool.execute(
    `INSERT INTO topic_configs 
     (name, description, keywords, scope, country, app_id, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description, JSON.stringify(keywords), scope, country || null, appId || null, 
     startDate || null, endDate || null, createdBy || null]
  );
  
  return { success: true, id: result.insertId };
}

/**
 * 获取专题列表
 */
export async function getTopics(filters = {}) {
  const { scope, country, appId, isActive } = filters;
  
  let sql = 'SELECT * FROM topic_configs WHERE 1=1';
  const params = [];
  
  if (scope) {
    sql += ' AND scope = ?';
    params.push(scope);
  }
  if (country) {
    sql += ' AND (country = ? OR country IS NULL)';
    params.push(country);
  }
  if (appId) {
    sql += ' AND (app_id = ? OR app_id IS NULL)';
    params.push(appId);
  }
  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive ? 1 : 0);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const [rows] = await pool.execute(sql, params);
  return rows.map(row => ({
    ...row,
    keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords
  }));
}

/**
 * 更新专题配置
 */
export async function updateTopic(id, data) {
  const fields = [];
  const values = [];
  
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.keywords !== undefined) { fields.push('keywords = ?'); values.push(JSON.stringify(data.keywords)); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
  if (data.startDate !== undefined) { fields.push('start_date = ?'); values.push(data.startDate); }
  if (data.endDate !== undefined) { fields.push('end_date = ?'); values.push(data.endDate); }
  
  if (fields.length === 0) return { success: false, error: '无更新字段' };
  
  values.push(id);
  await pool.execute(`UPDATE topic_configs SET ${fields.join(', ')} WHERE id = ?`, values);
  return { success: true };
}

/**
 * 删除专题
 */
export async function deleteTopic(id) {
  await pool.execute('DELETE FROM topic_configs WHERE id = ?', [id]);
  return { success: true };
}

// ==================== 关键词匹配扫描 ====================

/**
 * 获取适用于指定 App 的所有专题配置
 * 优先级: app > country > global
 */
export async function getApplicableTopics(appId, country) {
  const today = new Date().toISOString().split('T')[0];
  
  const [rows] = await pool.execute(
    `SELECT * FROM topic_configs 
     WHERE is_active = 1
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
       AND (
         scope = 'global'
         OR (scope = 'country' AND country = ?)
         OR (scope = 'app' AND app_id = ?)
       )
     ORDER BY 
       CASE scope WHEN 'app' THEN 1 WHEN 'country' THEN 2 ELSE 3 END`,
    [today, today, country, appId]
  );
  
  return rows.map(row => ({
    ...row,
    keywords: typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords
  }));
}

/**
 * 扫描单条评论，匹配所有适用专题
 * @param {Object} review - 评论对象，需包含 id, appId, country, translated_text
 * @returns {Array} 匹配结果列表
 */
export async function scanReviewForTopics(review) {
  const { id, appId, country, translated_text } = review;
  if (!translated_text) return [];
  
  const topics = await getApplicableTopics(appId, country);
  const matches = [];
  
  for (const topic of topics) {
    // const keywords = topic.keywords || [];
    const aiResult = await matchReviewWithAI(review, topic);
    if (aiResult.isMatch && aiResult.confidence > 0.7) { 
      matches.push({
        topicId: topic.id,
        topicName: topic.name,
        reviewId: id,
        appId,
        country,
        matchedKeywords: [aiResult.reason],
        matchedText: extractMatchContext(translated_text, topic.keywords[0] || '')
      });
    }
  }
  
  return matches;
}

/**
 * 提取关键词周围的上下文
 */
function extractMatchContext(text, keyword, contextLength = 50) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return text.substring(0, 100);
  
  const start = Math.max(0, idx - contextLength);
  const end = Math.min(text.length, idx + keyword.length + contextLength);
  
  return (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
}

/**
 * 批量扫描评论并保存匹配结果
 * @param {Array} reviews - 评论数组
 * @returns {Object} 扫描统计
 */
export async function batchScanReviews(reviews) {
  const stats = { scanned: 0, matched: 0, saved: 0 };
  
  for (const review of reviews) {
    stats.scanned++;
    try {
      const matches = await scanReviewForTopics(review);
      
      for (const match of matches) {
        stats.matched++;
        // 每条单独插入，不用事务
        await pool.execute(
          `INSERT INTO topic_matches 
           (topic_id, review_id, app_id, country, matched_keywords, matched_text)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE matched_keywords = VALUES(matched_keywords)`,
          [match.topicId, match.reviewId, match.appId, match.country,
           JSON.stringify(match.matchedKeywords), match.matchedText]
        );
        stats.saved++;
      }
    } catch (e) {
      console.error(`[Topics] Review ${review.id} 处理失败:`, e.message);
      // 继续处理下一条，不中断
    }
  }
  
  return stats;
}

// ==================== AI 专项分析 ====================

/**
 * 获取专题匹配的评论详情
 */
export async function getTopicMatchedReviews(topicId, options = {}) {
  const { startDate, endDate, limit = 100 } = options;
  
  let sql = `
    SELECT tm.*, tm.matched_keywords, tm.matched_text
    FROM topic_matches tm
    WHERE tm.topic_id = ?
  `;
  const params = [topicId];
  
  if (startDate) {
    sql += ' AND tm.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND tm.created_at <= ?';
    params.push(endDate);
  }
  
  sql += ` ORDER BY tm.created_at DESC LIMIT ${parseInt(limit)}`;
  
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * AI 分析专题反馈
 */
export async function analyzeTopicWithAI(topicId, reviews) {
  const [topicRows] = await pool.execute('SELECT * FROM topic_configs WHERE id = ?', [topicId]);
  if (topicRows.length === 0) throw new Error('专题不存在');
  
  const topic = topicRows[0];
  const client = getAIClient();
  const isQwen = !!process.env.TONGYI_API_KEY;
  const model = isQwen ? 'qwen3-max' : 'deepseek-chat';

  const prompt = `你是一位金融科技产品分析专家。请分析以下关于"${topic.name}"专题的用户反馈。

## 专题信息
- 名称: ${topic.name}
- 描述: ${topic.description || '无'}
- 关键词: ${JSON.stringify(topic.keywords)}

## 匹配到的用户反馈 (共${reviews.length}条)
${JSON.stringify(reviews.slice(0, 50).map(r => ({
  text: r.matched_text,
  keywords: r.matched_keywords
})), null, 2)}

请返回 JSON 格式的分析结果:
{
  "summary": "一句话总结",
  "sentimentBreakdown": { "positive": 数量, "negative": 数量, "neutral": 数量 },
  "painPoints": ["痛点1", "痛点2", "痛点3"],
  "recommendations": ["建议1", "建议2"]
}`;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是专业的VOC分析专家，请用中文回复，返回JSON格式。' },
      { role: 'user', content: prompt }
    ]
  });

  if (completion.usage) {
    await recordAICost(isQwen ? 'qwen' : 'deepseek', model, 'topic_analysis', completion.usage);
  }

  const result = JSON.parse(completion.choices[0].message.content);
  
  // 保存分析结果
  const today = new Date();
  const periodStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  await pool.execute(
    `INSERT INTO topic_analysis 
     (topic_id, analysis_date, period_start, period_end, total_matches,
      sentiment_positive, sentiment_negative, sentiment_neutral,
      ai_summary, pain_points, recommendations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ai_summary = VALUES(ai_summary),
       pain_points = VALUES(pain_points),
       recommendations = VALUES(recommendations)`,
    [
      topicId,
      today.toISOString().split('T')[0],
      periodStart.toISOString().split('T')[0],
      today.toISOString().split('T')[0],
      reviews.length,
      result.sentimentBreakdown?.positive || 0,
      result.sentimentBreakdown?.negative || 0,
      result.sentimentBreakdown?.neutral || 0,
      result.summary,
      JSON.stringify(result.painPoints),
      JSON.stringify(result.recommendations)
    ]
  );
  
  return result;
}

/**
 * 获取专题分析历史
 */
export async function getTopicAnalysisHistory(topicId, limit = 10) {
  const [rows] = await pool.execute(
    `SELECT * FROM topic_analysis WHERE topic_id = ? ORDER BY analysis_date DESC LIMIT ?`,
    [topicId, String(limit)]
  );
  
  return rows.map(row => ({
    ...row,
    pain_points: typeof row.pain_points === 'string' ? JSON.parse(row.pain_points) : row.pain_points,
    recommendations: typeof row.recommendations === 'string' ? JSON.parse(row.recommendations) : row.recommendations
  }));
}

async function matchReviewWithAI(review, topic) {
  const client = getAIClient();
  const model = process.env.TONGYI_API_KEY ? 'qwen-plus' : 'deepseek-chat';
  
  const prompt = `判断这条用户评论是否与专题相关。

专题名称：${topic.name}
专题描述：${topic.description || '无'}
参考关键词：${topic.keywords.join(', ')}

用户评论：${review.translated_text || review.text}

请返回JSON：
{
  "isMatch": true或false,
  "confidence": 0-1的置信度,
  "reason": "简短理由"
}`;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 200,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: '你是VOC分析专家，判断评论是否与指定专题相关。' },
      { role: 'user', content: prompt }
    ]
  });

  return JSON.parse(completion.choices[0].message.content);
}

export default {
  createTopic,
  getTopics,
  updateTopic,
  deleteTopic,
  getApplicableTopics,
  scanReviewForTopics,
  batchScanReviews,
  getTopicMatchedReviews,
  analyzeTopicWithAI,
  getTopicAnalysisHistory
};
