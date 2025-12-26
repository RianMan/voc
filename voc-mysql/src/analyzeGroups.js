import pool from './db/index.js';
import OpenAI from 'openai';
import { recordAICost } from './db/index.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.TONGYI_API_KEY,
  baseURL: process.env.DEEPSEEK_API_KEY 
    ? 'https://api.deepseek.com' 
    : 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

const MODEL = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'qwen-plus';

/**
 * 为单个App的某个月执行聚类分析
 */
async function analyzeAppMonthGroups(appId, year, month, options = {}) {
  const { minClusterSize = 3, maxReviews = 300 } = options;
  
  console.log(`\n📊 开始分析 App: ${appId} | ${year}年${month}月`);
  
  // 1. 计算月份的起止日期
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // 当月最后一天
  endDate.setHours(23, 59, 59, 999);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  console.log(`   📅 时间范围: ${startStr} ~ ${endStr}`);
  
  // 2. 获取该月的评论
  const [reviews] = await pool.execute(`
    SELECT 
      f.id, 
      f.summary, 
      f.root_cause,
      f.category,
      f.risk_level,
      m.translated_content,
      f.feedback_time
    FROM voc_feedbacks f
    LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1
    WHERE f.app_id = ?
      AND f.process_status = 'analyzed'
      AND f.risk_level IN ('High', 'Medium')
      AND f.status IN ('pending', 'confirmed', 'reported', 'in_progress')
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
    ORDER BY f.feedback_time DESC
    LIMIT ${maxReviews}
  `, [appId, startStr, endStr]);

  if (reviews.length < minClusterSize) {
    console.log(`   ⚠️  评论不足 ${minClusterSize} 条 (实际${reviews.length}条)，跳过聚类`);
    return { 
      skipped: true, 
      reason: 'insufficient_data', 
      count: reviews.length,
      year,
      month 
    };
  }

  console.log(`   📝 获取到 ${reviews.length} 条评论`);

  // 3. 调用AI进行聚类
  const inputData = reviews.map(r => ({
    id: r.id,
    summary: r.summary,
    root_cause: r.root_cause || r.summary,
    translated: (r.translated_content || '').substring(0, 150),
    category: r.category,
    risk: r.risk_level
  }));

  const prompt = `你是一位资深的产品运营专家。请对以下 ${reviews.length} 条用户反馈进行智能聚类分析。

## 时间范围
${year}年${month}月 (${startStr} ~ ${endStr})

## 输入数据
${JSON.stringify(inputData, null, 2)}

## 分析要求
1. **动态聚类**：根据问题的相似性自动决定聚类数量（建议5-15个）
2. **最小规模**：每个聚类至少包含 ${minClusterSize} 条评论
3. **相似度阈值**：相似度低于70%的评论单独归为"其他问题"
4. **优先级排序**：按影响范围(评论数量)降序排列
5. **问题标题**：用简洁的中文描述问题本质（不超过20字）

## 输出JSON格式
{
  "groups": [
    {
      "rank": 1,
      "title": "问题标题(简洁、具体)",
      "count": 涉及评论数,
      "percentage": 占比百分比(数字),
      "reviewIds": [评论ID数组],
      "rootCauseSummary": "根本原因分析(2-3句话)",
      "actionSuggestion": "改进建议(具体可执行)",
      "sampleQuotes": ["用户原话1", "用户原话2", "用户原话3"]
    }
  ],
  "uncategorized": 无法归类的评论数,
  "totalAnalyzed": 总分析数
}`;

  console.log(`   🤖 正在调用AI分析...`);

  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 6000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { 
        role: 'system', 
        content: '你是专业的VOC分析专家，擅长从大量用户反馈中识别核心问题模式。请严格按照JSON格式返回。' 
      },
      { role: 'user', content: prompt }
    ]
  });

  // 记录费用
  if (completion.usage) {
    await recordAICost(
      MODEL.includes('qwen') ? 'qwen' : 'deepseek',
      MODEL,
      'group_clustering',
      completion.usage
    );
  }

  let result;
  try {
    result = JSON.parse(completion.choices[0].message.content);
  } catch (e) {
    console.error('   ❌ AI返回JSON解析失败:', e);
    return { success: false, error: 'JSON解析失败' };
  }

  console.log(`   ✅ AI分析完成，识别出 ${result.groups?.length || 0} 个问题组`);

  // 4. 保存到数据库
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 删除该月的旧数据
    await conn.execute(
      'DELETE FROM review_groups WHERE app_id = ? AND year = ? AND month = ?',
      [appId, year, month]
    );

    // 插入新聚类
    for (const group of result.groups || []) {
      await conn.execute(`
        INSERT INTO review_groups 
        (app_id, year, month, group_title, group_rank, review_count, percentage,
         review_ids, root_cause_summary, action_suggestion, sample_reviews, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `, [
        appId,
        year,
        month,
        group.title,
        group.rank,
        group.count,
        group.percentage,
        JSON.stringify(group.reviewIds),
        group.rootCauseSummary,
        group.actionSuggestion,
        JSON.stringify(group.sampleQuotes)
      ]);
    }

    await conn.commit();
    console.log(`   💾 数据保存成功\n`);

    return {
      success: true,
      appId,
      year,
      month,
      groupsCreated: result.groups?.length || 0,
      totalAnalyzed: result.totalAnalyzed,
      uncategorized: result.uncategorized
    };

  } catch (e) {
    await conn.rollback();
    console.error('   ❌ 数据库保存失败:', e);
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * 批量执行所有App的本月聚类
 */
async function analyzeCurrentMonth(options = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  console.log(`🚀 开始批量聚类分析 (${year}年${month}月)\n`);

  // 获取所有需要分析的App
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);
  
  const [apps] = await pool.execute(`
    SELECT DISTINCT f.app_id, f.app_name, COUNT(*) as review_count
    FROM voc_feedbacks f
    WHERE f.process_status = 'analyzed'
      AND f.app_id != 'Unknown'
      AND f.risk_level IN ('High', 'Medium')
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
    GROUP BY f.app_id, f.app_name
    HAVING review_count >= 5
    ORDER BY review_count DESC
  `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

  console.log(`找到 ${apps.length} 个App需要分析\n`);

  const results = [];
  for (const app of apps) {
    try {
      const result = await analyzeAppMonthGroups(app.app_id, year, month, options);
      if (result.success) {
        await finalizeClustering(app.app_id, year, month);
      }
      // results.push({ appId: app.app_id, appName: app.app_name, ...result });
    } catch (e) {
      console.error(`❌ ${app.app_id} 分析失败:`, e.message);
      results.push({ appId: app.app_id, success: false, error: e.message });
    }
  }

  console.log('\n✨ 批量分析完成！');
  console.log('汇总:');
  results.forEach(r => {
    if (r.success) {
      console.log(`  ✅ ${r.appId}: ${r.groupsCreated} 个问题组 (分析 ${r.totalAnalyzed} 条)`);
    } else if (r.skipped) {
      console.log(`  ⏭️  ${r.appId}: 数据不足，跳过`);
    } else {
      console.log(`  ❌ ${r.appId}: 失败 - ${r.error}`);
    }
  });

  return results;
}

/**
 * 分析指定月份
 */
async function analyzeSpecificMonth(year, month, options = {}) {
  console.log(`🚀 开始批量聚类分析 (${year}年${month}月)\n`);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);
  
  const [apps] = await pool.execute(`
    SELECT DISTINCT f.app_id, f.app_name, COUNT(*) as review_count
    FROM voc_feedbacks f
    WHERE f.process_status = 'analyzed'
      AND f.app_id != 'Unknown'
      AND f.risk_level IN ('High', 'Medium')
      AND DATE(f.feedback_time) >= ?
      AND DATE(f.feedback_time) <= ?
    GROUP BY f.app_id, f.app_name
    HAVING review_count >= 5
    ORDER BY review_count DESC
  `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

  console.log(`找到 ${apps.length} 个App需要分析\n`);

  const results = [];
  for (const app of apps) {
    try {
      const result = await analyzeAppMonthGroups(app.app_id, year, month, options);
      results.push({ appId: app.app_id, appName: app.app_name, ...result });
    } catch (e) {
      console.error(`❌ ${app.app_id} 分析失败:`, e.message);
      results.push({ appId: app.app_id, success: false, error: e.message });
    }
  }

  console.log('\n✨ 批量分析完成！');
  return results;
}

async function runAnalysis(appId, year, month) {
    // 1. 执行现有的 AI 聚类逻辑 (生成 Top N 个组)
    console.log(`正在为 ${appId} 执行 AI 聚类...`);
    await performAiClustering(appId, year, month); 

    // 2. 紧接着调用“补漏”逻辑，处理剩下没被聚类的评论
    console.log(`正在归纳未分类评论到“其他”...`);
    await finalizeClustering(appId, year, month);
}

// 定义补漏函数 (核心逻辑)
/**
 * 补漏函数：将未聚类的评论归到"其他待分类问题"
 */
async function finalizeClustering(appId, year, month) {
  console.log(`  🔍 检查未聚类评论...`);
  
  // 1. 计算该月的起止日期
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  // 2. 获取该月所有符合条件的评论 ID
  const [allReviews] = await pool.execute(`
    SELECT id 
    FROM voc_feedbacks 
    WHERE app_id = ? 
      AND process_status = 'analyzed'
      AND risk_level IN ('High', 'Medium')
      AND status IN ('pending', 'confirmed', 'reported', 'in_progress')
      AND DATE(feedback_time) >= ?
      AND DATE(feedback_time) <= ?
  `, [appId, startStr, endStr]);
  
  const allIds = allReviews.map(r => r.id);
  
  if (allIds.length === 0) {
    console.log(`  ⏭️  无符合条件的评论，跳过`);
    return;
  }
  
  // 3. 获取已分配到聚类的评论 ID
  const [assignedGroups] = await pool.execute(`
    SELECT review_ids 
    FROM review_groups 
    WHERE app_id = ? AND year = ? AND month = ?
  `, [appId, year, month]);
  
  let assignedIds = [];
  assignedGroups.forEach(g => {
    const ids = typeof g.review_ids === 'string' ? JSON.parse(g.review_ids) : g.review_ids;
    assignedIds = assignedIds.concat(ids);
  });
  
  // 4. 计算差集：未归类的评论
  const unassignedIds = allIds.filter(id => !assignedIds.includes(id));
  
  if (unassignedIds.length === 0) {
    console.log(`  ✅ 所有评论已聚类 (${allIds.length}/${allIds.length})`);
    return;
  }
  
  console.log(`  📋 发现 ${unassignedIds.length} 条未聚类评论 (总数 ${allIds.length})`);
  
  // 5. 计算当前最大的 Rank，把"其他"放在最后
  const [maxRankRow] = await pool.execute(`
    SELECT MAX(group_rank) as max_rank 
    FROM review_groups 
    WHERE app_id = ? AND year = ? AND month = ?
  `, [appId, year, month]);
  
  const nextRank = (maxRankRow[0].max_rank || 0) + 1;
  const percentage = ((unassignedIds.length / allIds.length) * 100).toFixed(2);
  
  // 6. 插入"其他待分类问题"分组
  await pool.execute(`
    INSERT INTO review_groups 
    (app_id, year, month, group_title, group_rank, review_count, percentage,
     review_ids, root_cause_summary, action_suggestion, status)
    VALUES (?, ?, ?, '其他待分类问题', ?, ?, ?, ?, 
            'AI 聚类未覆盖的零散反馈', 
            '建议人工抽检或标记为低优先级', 
            'pending')
  `, [
    appId, year, month, nextRank, unassignedIds.length, percentage,
    JSON.stringify(unassignedIds)
  ]);
  
  console.log(`  ✅ 已归类到"其他待分类问题" (Rank ${nextRank}, ${percentage}%)\n`);
}
/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 默认：分析当前月
    await analyzeCurrentMonth();
  } else if (args.length === 1) {
    // 单个App + 当前月
    const appId = args[0];
    const now = new Date();
    await analyzeAppMonthGroups(appId, now.getFullYear(), now.getMonth() + 1);
  } else if (args.length === 3) {
    // 指定 App + 年 + 月
    const [appId, year, month] = args;
    await analyzeAppMonthGroups(appId, parseInt(year), parseInt(month));
  } else if (args.length === 2) {
    // 指定 年 + 月，分析所有App
    const [year, month] = args;
    await analyzeSpecificMonth(parseInt(year), parseInt(month));
  }

  process.exit(0);
}

main().catch(error => {
  console.error('💥 执行失败:', error);
  process.exit(1);
});