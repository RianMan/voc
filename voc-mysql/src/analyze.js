import OpenAI from 'openai';
import dotenv from 'dotenv';
import pool from './db.js';
import { recordAICost } from './db.js';

dotenv.config();

const apiKey = process.env.TONGYI_API_KEY || process.env.DEEPSEEK_API_KEY;
const baseURL = process.env.TONGYI_API_KEY 
  ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  : (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');

const openai = new OpenAI({ apiKey, baseURL, timeout: 60000 }); // SDK层超时设为60秒
const MODEL_NAME = process.env.TONGYI_API_KEY ? 'qwen-plus' : 'deepseek-chat';

const SYSTEM_PROMPT = `
你是一位资深的金融App产品经理和用户体验专家。请分析用户的反馈内容。

【输出JSON格式要求】:
{
    "category": "Tech_Bug" | "Compliance_Risk" | "Product_Issue" | "Positive" | "User_Error" | "Other",
    "risk_level": "High" | "Medium" | "Low",
    "summary": "中文一句话摘要",
    "root_cause": "中文深度归因",
    "action_advice": "中文行动建议",
    "suggested_reply": "高情商回复(当地语言)",
    "sentiment_score": 0.5 (范围 -1到1, 0为中性),
    "translated_text": "中文翻译"
}
`;

// 辅助工具：休眠函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 辅助工具：带超时的 Promise
const timeoutPromise = (ms, promise) => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`请求超时 (${ms/1000}秒)`));
        }, ms);
        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
};

async function analyzeFeedbacks() {
    const conn = await pool.getConnection();
    
    try {
        // 1. 获取待分析数据 
        // 每次取 5 条，保持小步快跑
        const BATCH_SIZE = 5;
        const [rows] = await conn.execute(
            `SELECT f.id, f.app_name, m.content 
             FROM voc_feedbacks f
             JOIN voc_feedback_messages m ON f.id = m.feedback_id
             WHERE f.process_status = 'raw' 
               AND m.role = 'user' 
               AND m.sequence_num = 1
             ORDER BY f.id ASC 
             LIMIT ?`,
            [BATCH_SIZE.toString()]
        );

        if (rows.length === 0) {
            console.log("🎉 所有数据已分析完毕，暂无新数据。");
            return;
        }

        console.log(`🔎 本批次待分析: ${rows.length} 条 (Start ID: ${rows[0].id})`);

        for (const item of rows) {
            process.stdout.write(`   🔄 [ID:${item.id}] ${item.app_name}... `);
            
            try {
                // 设置 45秒 逻辑超时，给 AI 足够的思考时间
                const analysis = await timeoutPromise(45000, callAI(item.content));
                
                // 3. 更新数据库
                await conn.execute(
                    `UPDATE voc_feedbacks SET 
                        category = ?, risk_level = ?, summary = ?, 
                        root_cause = ?, action_advice = ?, suggested_reply = ?, 
                        sentiment_score = ?, process_status = 'analyzed'
                     WHERE id = ?`,
                    [
                        analysis.category || 'Other',
                        analysis.risk_level || 'Low',
                        analysis.summary || '无摘要',
                        analysis.root_cause || '',
                        analysis.action_advice || '',
                        analysis.suggested_reply || '',
                        analysis.sentiment_score || 0,
                        item.id
                    ]
                );

                if (analysis.translated_text) {
                    await conn.execute(
                        `UPDATE voc_feedback_messages SET translated_content = ? 
                         WHERE feedback_id = ? AND role = 'user' AND sequence_num = 1`,
                        [analysis.translated_text, item.id]
                    );
                }
                console.log("✅");

            } catch (err) {
                console.log(`❌ 错误: ${err.message}`);
                await sleep(60000);
            } finally {
                conn.release();  // 每轮都释放
            }
        }
        
        // 正常处理完一批，继续下一批
        await analyzeFeedbacks(); 

    } catch (fatalError) {
        console.error("💥 发生严重错误:", fatalError);
        console.log("⏳ 严重错误冷却：暂停 2 分钟...");
        await sleep(120000);
        // 顽强地重启自己
        await analyzeFeedbacks();
    } finally {
        conn.release();
    }
}

async function callAI(text) {
    if (!text || text.length < 2) return {};

    const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `用户评论内容:\n${text}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
    });

    if (completion.usage) {
        await recordAICost('deepseek', MODEL_NAME, 'analysis', completion.usage);
    }

    try {
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.error("AI返回JSON解析失败");
        return {};
    }
}

async function main() {
    console.log("=== 开始 AI 分析任务 (自动熔断重试版) ===");
    await analyzeFeedbacks();
    console.log("\n✨ 全部任务执行完毕！");
    process.exit();
}

main();