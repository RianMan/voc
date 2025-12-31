import pool from './db/connection.js';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY, 
  baseURL: 'https://api.deepseek.com',
  timeout: 60000 
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ✅ 导出函数，供 API 调用
export async function runAnalysis(targetAppId = null) {
  console.log('🚀 [Analysis] 开始 AI 分析任务...');
  let processedCount = 0;

  // 循环处理，直到没有 raw 数据为止
  while (true) {
    try {
      // 1. 查询剩余数量
      let countSql = "SELECT COUNT(*) as total FROM voc_feedbacks WHERE process_status = 'raw'";
      let querySql = "SELECT f.id, f.content, f.rating, f.app_name, f.country FROM voc_feedbacks f WHERE process_status = 'raw'";
      const params = [];

      if (targetAppId) {
        countSql += " AND app_id = ?";
        querySql += " AND app_id = ?";
        params.push(targetAppId);
      }
      
      querySql += " LIMIT 20";

      // 2. 查询剩余
      const [countResult] = await pool.execute(countSql, params);
      const totalRemaining = countResult[0].total;

      if (totalRemaining === 0) {
        console.log('🎉 [Analysis] 所有数据分析完毕！暂无新数据。');
        break; 
      }
  

      // 3. 获取数据
      const [reviews] = await pool.execute(querySql, params);

      console.log(`📊 剩余待处理: ${totalRemaining} | 本批次: ${reviews.length}`);

      for (const review of reviews) {
        try {
          const prompt = `
            你是一名多语言金融客服专家。
            App: ${review.app_name} (${review.country})
            内容: ${review.content}
            评分: ${review.rating || '无'}星

            请输出纯JSON:
            {
              "translated": "中文翻译",
              "sentiment": "Positive/Neutral/Negative",
              "risk": "High/Medium/Low", 
              "category": "资金问题/功能体验/催收服务/注册登录/其他"
            }
          `;

          const completion = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          });

          const result = JSON.parse(completion.choices[0].message.content);

          // 更新主表
          await pool.execute(`
            UPDATE voc_feedbacks SET 
              translated_content = ?, 
              sentiment = ?, 
              risk_level = ?, 
              category = ?, 
              process_status = 'analyzed' 
            WHERE id = ?
          `, [
            result.translated, 
            result.sentiment, 
            result.risk, 
            result.category, 
            review.id
          ]);

          // 同步消息表
          await pool.execute(`
            UPDATE voc_feedback_messages SET translated_content = ? 
            WHERE feedback_id = ? AND role = 'user'
          `, [result.translated, review.id]);

          processedCount++;
          process.stdout.write('.'); // 进度点

        } catch (innerErr) {
          console.error(`❌ ID:${review.id} 分析失败:`, innerErr.message);
        }
      }
      
      // 批次间休息
      await sleep(500);

    } catch (fatalError) {
      console.error('\n💥 分析过程发生严重错误:', fatalError.message);
      throw fatalError; // 向外抛出，让 API 知道出错了
    }
  }

  console.log(`\n✅ 本次任务共处理: ${processedCount} 条`);
  return { success: true, processed: processedCount };
}

// ✅ 命令行自启动判断
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAnalysis()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}