import pool from '../db/connection.js';
import OpenAI from 'openai';
import { DEPARTMENTS, getOwnersByDepartments } from '../config/departments.js';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY, 
  baseURL: 'https://api.deepseek.com',
  timeout: 120000 // 2分钟超时
});

// 辅助函数：休眠，防止 API 限流
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================== 1. 月度反馈提炼 (全量分批 + 二次聚合) ==================
export async function generateMonthlyInsights(appId, monthStr) {
  console.log(`🚀 [Insight] 开始生成全量反馈提炼: ${appId} - ${monthStr}`);

  const BATCH_SIZE = 200; // 每批处理 200 条
  let offset = 0;
  let hasMore = true;
  
  // 临时存储所有批次的中间结果
  let allIntermediateInsights = [];
  let totalReviewsProcessed = 0;

  // ---------------- Phase 1: 分批提取 (Map) ----------------
  while (hasMore) {
    // 1. 分页获取数据
    const [reviews] = await pool.query(`
      SELECT id, translated_content, content
      FROM voc_feedbacks
      WHERE app_id = ? 
        AND risk_level IN ('High', 'Medium')
        AND DATE_FORMAT(feedback_time, '%Y-%m') = ?
      ORDER BY feedback_time DESC
      LIMIT ? OFFSET ?
    `, [appId, monthStr, Number(BATCH_SIZE), Number(offset)]);

    if (reviews.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`   📦 [Insight] 处理批次: ${offset} ~ ${offset + reviews.length}`);

    // 2. 准备 AI 输入
    const aiInput = reviews.map(r => ({
      id: r.id,
      text: (r.translated_content || r.content || '').substring(0, 150)
    }));

    const prompt = `
      分析这 ${reviews.length} 条用户反馈。
      请提取出最核心的 5-8 个痛点问题。
      
      返回 JSON:
      {
        "insights": [
          { "title": "问题标题", "count": 出现次数, "sample_id": 代表性评论ID }
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
      if (result.insights) {
        // 补全样本内容，方便后续聚合
        const enrichedInsights = result.insights.map(item => {
          const sample = reviews.find(r => r.id === item.sample_id) || reviews[0];
          return {
            ...item,
            sample_content: sample.content,
            sample_translated: sample.translated_content,
            sample_source: sample.source, // 假设 SQL 没查 source，需补上或忽略
            sample_link: sample.source_url
          };
        });
        allIntermediateInsights = allIntermediateInsights.concat(enrichedInsights);
      }
    } catch (e) {
      console.error(`   ⚠️ 批次分析失败 (Offset ${offset}):`, e.message);
    }

    offset += BATCH_SIZE;
    totalReviewsProcessed += reviews.length;
    await sleep(1000); // 休息一下避免限流
  }

  if (allIntermediateInsights.length === 0) return { success: true, message: '无有效数据' };

  console.log(`   🔄 [Insight] 初步提取完成，共 ${allIntermediateInsights.length} 个碎片观点，开始二次聚合...`);

  // ---------------- Phase 2: 全局聚合 (Reduce) ----------------
  // 将所有批次的碎片观点发给 AI，进行合并去重
  const aggregationPrompt = `
    以下是分批分析得到的用户反馈痛点列表（共 ${totalReviewsProcessed} 条评论）。
    请将这些分散的痛点进行【合并同类项】和【二次聚类】，生成最终的 Top 8-12 月度洞察。
    
    输入数据：
    ${JSON.stringify(allIntermediateInsights.map(i => ({ title: i.title, count: i.count })))}

    任务：
    1. 合并相似问题 (如 "收不到验证码" 和 "OTP没反应" 合并)。
    2. 累加 Count 数量。
    3. 重新拟定专业的标题。
    4. 分配部门和建议。
    
    返回 JSON:
    {
      "final_insights": [
        {
          "title": "标准化标题",
          "total_count": 合并后的总数,
          "suggestion": "优化建议",
          "departments": ["部门1"],
          "original_titles": ["原标题1", "原标题2"] // 用于回溯找样本
        }
      ]
    }
  `;

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: aggregationPrompt }],
      response_format: { type: 'json_object' }
    });

    const finalResult = JSON.parse(completion.choices[0].message.content);
    const finalInsights = finalResult.final_insights || [];

    // ---------------- Phase 3: 入库 ----------------
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      // 清理旧数据
      await conn.execute(
        'DELETE FROM monthly_insights WHERE app_id = ? AND batch_month = ? AND task_id IS NULL',
        [appId, monthStr]
      );

      for (const item of finalInsights) {
        // 回溯找一个最佳样本：从原始碎片中，找到 title 匹配度最高的那个的样本
        // 简单策略：在 intermediate 中找一个 original_titles 里的，或者直接找 title 相似的
        const match = allIntermediateInsights.find(i => 
          (item.original_titles && item.original_titles.includes(i.title)) || 
          item.title.includes(i.title) || 
          i.title.includes(item.title)
        ) || allIntermediateInsights[0];

        const owners = getOwnersByDepartments(item.departments);

        await conn.execute(`
          INSERT INTO monthly_insights 
          (batch_month, app_id, problem_title, problem_count, 
           sample_content, sample_translated, sample_source, sample_link,
           ai_suggestion, departments, owners)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          monthStr, appId, item.title, item.total_count,
          match?.sample_content || '', match?.sample_translated || '', 'AI Aggregated', '',
          item.suggestion, JSON.stringify(item.departments), JSON.stringify(owners)
        ]);
      }

      await conn.commit();
      console.log(`✅ [Insight] 全量分析完成，生成 ${finalInsights.length} 条洞察`);
      return { success: true, count: finalInsights.length };

    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[Insight] 聚合失败:', err);
    return { success: false, error: err.message };
  }
}

// ================== 2. 专题趋势 (全量分批 + 累加统计) ==================
export async function generateTopicTrends(appId, monthStr) {
  console.log(`🚀 [Topic] 开始生成全量专题子问题分析: ${appId} - ${monthStr}`);

  // 1. 获取专题配置
  const [topics] = await pool.execute(
    'SELECT id, name, keywords FROM topic_configs WHERE is_active = 1'
  );
  if (topics.length === 0) return { success: false, message: '未配置任何专题' };

  // 2. 准备全局聚合容器 Map<Key, Data>
  // Key = `${topic_id}::${sub_issue_title}`
  const globalStats = new Map();

  const BATCH_SIZE = 200;
  let offset = 0;
  let hasMore = true;

  // ---------------- Phase 1: 循环分批处理 ----------------
  while (hasMore) {
    // 分页查数据
    const [reviews] = await pool.query(`
      SELECT id, source, source_url, translated_content, content
      FROM voc_feedbacks
      WHERE app_id = ? 
        AND process_status = 'analyzed'
        AND DATE_FORMAT(feedback_time, '%Y-%m') = ?
      ORDER BY feedback_time DESC
      LIMIT ? OFFSET ?
    `, [appId, monthStr, Number(BATCH_SIZE), Number(offset)]);

    if (reviews.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`   📦 [Topic] 分析批次: ${offset} ~ ${offset + reviews.length}`);

    // AI 请求
    const reviewInputs = reviews.map(r => ({
      id: r.id,
      text: (r.translated_content || r.content || '').substring(0, 150)
    }));

    const topicInputs = topics.map(t => ({
      id: t.id,
      name: t.name,
      desc: `关键词参考: ${t.keywords}`
    }));

    const prompt = `
      【任务】：对 ${reviews.length} 条评论进行专题匹配和子问题拆分。
      
      【专题列表】：${JSON.stringify(topicInputs)}
      【可选部门】：${JSON.stringify(DEPARTMENTS)}

      要求：
      1. 判断评论属于哪个专题。
      2. 在专题下拆分具体子问题（如"催收" -> "未到期催收"）。
      3. 统计本批次数量。
      4. 即使只有一个评论匹配，也要记录。

      返回 JSON:
      {
        "results": [
          {
            "topic_id": 专题ID,
            "sub_issue_title": "子问题标题", 
            "count": 本批次数量,
            "sample_id": 本批次中典型的评论ID,
            "suggestion": "建议",
            "departments": ["部门"]
          }
        ]
      }
    `;

    try {
      const completion = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: JSON.stringify(reviewInputs) + "\n\n" + prompt }],
        response_format: { type: 'json_object' }
      });
      
      const aiResult = JSON.parse(completion.choices[0].message.content);
      const batchResults = aiResult.results || [];

      // ---------------- 核心逻辑：累加到全局 Map ----------------
      for (const res of batchResults) {
        // 归一化 Key：TopicID + 子问题标题
        const key = `${res.topic_id}::${res.sub_issue_title}`;

        if (!globalStats.has(key)) {
          // 如果是第一次遇到这个子问题，初始化
          const sample = reviews.find(r => r.id === res.sample_id) || reviews[0];
          globalStats.set(key, {
            topic_id: res.topic_id,
            sub_issue_title: res.sub_issue_title,
            total_count: 0,
            sample_content: sample?.content || '',
            sample_translated: sample?.translated_content || '',
            sample_source: sample?.source || '',
            sample_link: sample?.source_url || '',
            suggestion: res.suggestion,
            departments: res.departments
          });
        }

        // 累加数量
        const entry = globalStats.get(key);
        entry.total_count += res.count;
        
        // 可以在这里做个判断：如果后来的批次有更好的建议，也可以更新 entry.suggestion
      }

    } catch (e) {
      console.error(`   ⚠️ [Topic] 批次分析失败 (Offset ${offset}):`, e.message);
    }

    offset += BATCH_SIZE;
    await sleep(800); // 避免并发过高
  }

  console.log(`   🔄 [Topic] 全量扫描结束，共发现 ${globalStats.size} 个子问题类型，开始入库...`);

  // ---------------- Phase 2: 批量入库 ----------------
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      'DELETE FROM topic_trends WHERE app_id = ? AND batch_month = ? AND task_id IS NULL',
      [appId, monthStr]
    );

    for (const item of globalStats.values()) {
      const topicConfig = topics.find(t => t.id === item.topic_id);
      if (!topicConfig) continue;

      const owners = getOwnersByDepartments(item.departments);

      await conn.execute(`
        INSERT INTO topic_trends 
        (topic_config_id, topic_name, batch_month, app_id, issue_count,
         sample_content, sample_translated, sample_source, sample_link,
         ai_suggestion, departments, owners)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.topic_id,
        item.sub_issue_title || topicConfig.name, // 存储子问题标题
        monthStr,
        appId,
        item.total_count, // 这里存的是全月累加后的总数
        item.sample_content,
        item.sample_translated,
        item.sample_source,
        item.sample_link,
        item.suggestion,
        JSON.stringify(item.departments || []),
        JSON.stringify(owners)
      ]);
    }

    await conn.commit();
    return { success: true, count: globalStats.size };

  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}