import pool from '../db/connection.js';
import OpenAI from 'openai';
import { DEPARTMENTS, getOwnersByDepartments } from '../config/departments.js';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY, 
  baseURL: 'https://api.deepseek.com',
  timeout: 120000 // 设置更长的超时时间，因为批量分析比较慢
});

// ================== 1. 月度反馈提炼 (盲盒聚类) ==================
export async function generateMonthlyInsights(appId, monthStr) {
  console.log(`🚀 [Insight] 开始生成反馈提炼: ${appId} - ${monthStr}`);

  // 1. 获取数据
  const [reviews] = await pool.execute(`
    SELECT id, source, source_url, translated_content, content
    FROM voc_feedbacks
    WHERE app_id = ? 
      AND risk_level IN ('High', 'Medium')
      AND DATE_FORMAT(feedback_time, '%Y-%m') = ?
    ORDER BY feedback_time DESC
    LIMIT 500
  `, [appId, monthStr]);

  if (reviews.length === 0) return { success: true, message: '暂无数据' };

  // 2. 准备 AI 输入
  const aiInput = reviews.map(r => ({
    id: r.id,
    text: (r.translated_content || r.content || '').substring(0, 100)
  }));

  // 3. 调用 AI
  const prompt = `
    你是一位金融产品专家。请对以下 ${reviews.length} 条 MexiCash 用户反馈进行聚类分析。
    
    可选部门：${JSON.stringify(DEPARTMENTS)}

    任务：
    1. 聚合相似问题，提炼出 Top 8-12 个核心痛点。
    2. 问题标题(title)要专业具体（如"OTP验证码接收延迟"）。
    3. 从原始数据中找到 1 条最具代表性的评论 ID (sample_id)。
    4. 给出具体的优化建议 (suggestion)。
    5. 分配 1-2 个相关部门。

    返回 JSON:
    {
      "insights": [
        {
          "title": "问题标题",
          "count": 数量,
          "sample_id": ID,
          "suggestion": "建议...",
          "departments": ["产品", "UI"]
        }
      ]
    }
  `;

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: JSON.stringify(aiInput) + "\n\n" + prompt }],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    const insights = result.insights || [];

    // 4. 入库
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      await conn.execute(
        'DELETE FROM monthly_insights WHERE app_id = ? AND batch_month = ? AND task_id IS NULL',
        [appId, monthStr]
      );

      for (const item of insights) {
        const sampleReview = reviews.find(r => r.id === item.sample_id) || reviews[0];
        const owners = getOwnersByDepartments(item.departments);

        await conn.execute(`
          INSERT INTO monthly_insights 
          (batch_month, app_id, problem_title, problem_count, 
           sample_content, sample_translated, sample_source, sample_link,
           ai_suggestion, departments, owners)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          monthStr, appId, item.title, item.count,
          sampleReview.content, sampleReview.translated_content, sampleReview.source, sampleReview.source_url,
          item.suggestion, JSON.stringify(item.departments), JSON.stringify(owners)
        ]);
      }

      await conn.commit();
      console.log(`✅ [Insight] 已生成 ${insights.length} 条提炼数据`);
      return { success: true, count: insights.length };

    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[Insight] AI分析失败:', err);
    return { success: false, error: err.message };
  }
}

// ================== 2. 专题趋势 (AI 语义匹配) ==================
/**
 * 升级版：使用 AI 进行语义匹配，而非 SQL LIKE
 */
export async function generateTopicTrends(appId, monthStr) {
  console.log(`🚀 [Topic] 开始生成专题趋势 (AI语义版): ${appId} - ${monthStr}`);

  // 1. 获取所有启用的专题
  const [topics] = await pool.execute(
    'SELECT id, name, keywords FROM topic_configs WHERE is_active = 1'
  );

  if (topics.length === 0) {
    return { success: false, message: '未配置任何专题' };
  }

  // 2. 获取本月所有评论 (分批处理，避免 Token 爆炸)
  // 这里我们一次取 200 条作为样本，如果数据量巨大，建议改为循环分批处理
  const [reviews] = await pool.execute(`
    SELECT id, source, source_url, translated_content, content
    FROM voc_feedbacks
    WHERE app_id = ? 
      AND DATE_FORMAT(feedback_time, '%Y-%m') = ?
    ORDER BY feedback_time DESC
    LIMIT 300 
  `, [appId, monthStr]);

  if (reviews.length === 0) return { success: true, message: '本月无数据' };

  console.log(`   📦 待分析样本: ${reviews.length} 条 | 专题数: ${topics.length} 个`);

  // 3. 构建 AI 请求数据
  // 简化评论内容，只保留 id 和 文本
  const reviewInputs = reviews.map(r => ({
    id: r.id,
    text: (r.translated_content || r.content || '').substring(0, 150) // 限制长度
  }));

  // 简化专题内容
  const topicInputs = topics.map(t => ({
    id: t.id,
    name: t.name,
    desc: `关键词参考: ${t.keywords}` // 告诉 AI 这些关键词只是参考，语义符合也要算
  }));

  const prompt = `
    你是一个智能分类助手。请根据语义，将评论分配到对应的专题中。
    
    【待匹配专题列表】：
    ${JSON.stringify(topicInputs)}

    【评论列表】：
    ${JSON.stringify(reviewInputs)}

    【可选部门】：${JSON.stringify(DEPARTMENTS)}

    任务要求：
    1. 遍历每一条评论，判断它是否属于某个或多个专题。
    2. 匹配逻辑：**不要局限于关键词**，要理解语义。例如"闪退"、"很卡"都属于"APP体验"专题。
    3. 统计每个专题命中的评论ID。
    4. 对每个命中的专题，生成一份分析报告（痛点总结、建议、部门）。

    返回 JSON 格式：
    {
      "results": [
        {
          "topic_id": 专题ID,
          "matched_review_ids": [101, 102, ...],
          "sample_id": 最典型的一条评论ID,
          "suggestion": "针对该专题的优化建议...",
          "departments": ["部门1"]
        }
      ]
    }
    注意：如果没有评论匹配某个专题，该专题可以不返回或返回空列表。
  `;

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    let aiResult;
    try {
      aiResult = JSON.parse(completion.choices[0].message.content);
    } catch (parseErr) {
      console.error('JSON解析失败，AI返回:', completion.choices[0].message.content);
      throw new Error('AI返回格式错误');
    }

    const results = aiResult.results || [];
    console.log(`   🤖 AI 分析完成，命中 ${results.length} 个专题`);

    // 4. 入库
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 清理旧数据
      await conn.execute(
        'DELETE FROM topic_trends WHERE app_id = ? AND batch_month = ? AND task_id IS NULL',
        [appId, monthStr]
      );

      let totalHits = 0;

      for (const res of results) {
        const matchedIds = res.matched_review_ids || [];
        if (matchedIds.length === 0) continue;

        // 找到对应的专题配置信息
        const topicConfig = topics.find(t => t.id === res.topic_id);
        if (!topicConfig) continue;

        // 找到样本评论信息
        const sampleReview = reviews.find(r => r.id === res.sample_id) || reviews.find(r => r.id === matchedIds[0]);
        const owners = getOwnersByDepartments(res.departments);

        await conn.execute(`
          INSERT INTO topic_trends 
          (topic_config_id, topic_name, batch_month, app_id, issue_count,
           sample_content, sample_translated, sample_source, sample_link,
           ai_suggestion, departments, owners)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          topicConfig.id, topicConfig.name, monthStr, appId, matchedIds.length,
          sampleReview?.content || '', sampleReview?.translated_content || '', sampleReview?.source || '', sampleReview?.source_url || '',
          res.suggestion || '暂无建议', JSON.stringify(res.departments || []), JSON.stringify(owners)
        ]);

        totalHits++;
      }

      await conn.commit();
      return { success: true, count: totalHits };

    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('[Topic] 处理失败:', err);
    return { success: false, error: err.message };
  }
}