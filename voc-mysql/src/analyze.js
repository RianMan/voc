import pool from './db/connection.js';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY, 
  baseURL: 'https://api.deepseek.com',
  timeout: 60000 // 60秒超时设置
});

// 辅助工具：休眠函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function analyzeLoop() {
  console.log('🚀 开始全自动分析任务 (翻译 + 情感 + 风险)...');

  while (true) {
    try {
      // 1. 查询剩余数量
      const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total FROM voc_feedbacks WHERE process_status = 'raw'
      `);
      const totalRemaining = countResult[0].total;

      if (totalRemaining === 0) {
        console.log('🎉 所有数据分析完毕！暂无新数据。');
        break; // 退出循环
      }

      // 2. 获取本批次数据 (一次50条)
      const [reviews] = await pool.execute(`
        SELECT f.id, f.content, f.rating, f.app_name, f.country 
        FROM voc_feedbacks f 
        WHERE process_status = 'raw' 
        LIMIT 50
      `);

      console.log(`\n📊 剩余待处理: ${totalRemaining} 条 | 本批次: ${reviews.length} 条`);

      // 3. 并行/串行处理本批次
      for (const [index, review] of reviews.entries()) {
        const currentLeft = totalRemaining - index - 1;
        process.stdout.write(`   [${index + 1}/${reviews.length}] 分析 ID:${review.id}... `);

        try {
          // AI 分析
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

          // 更新数据库
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

          console.log(`✅`); // 成功

        } catch (innerErr) {
          console.log(`❌ (跳过)`);
          console.error(`      错误: ${innerErr.message}`);
          // 遇到单条错误不退出，继续下一条
        }
      }

      // 批次之间稍微休息一下，防止数据库压力过大
      await sleep(1000);

    } catch (fatalError) {
      console.error('\n💥 发生连接错误或严重异常:', fatalError.message);
      console.log('⏳ 5秒后自动重试...');
      await sleep(5000);
      // while循环会继续，实现自动重试
    }
  }

  process.exit(0);
}

// 启动主循环
analyzeLoop();