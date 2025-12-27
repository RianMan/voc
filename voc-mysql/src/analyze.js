import OpenAI from 'openai';
import dotenv from 'dotenv';
import { pool } from './db/index.js';
import { recordAICost } from './db/index.js';

dotenv.config();

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseURL = 'https://api.deepseek.com';

const openai = new OpenAI({ apiKey, baseURL, timeout: 60000 });
const MODEL_NAME = 'deepseek-chat';

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
    "translated_text": "中文翻译(如果原文已是中文则留空)"
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

/**
 * 判断文本是否为中文
 */
function isChinese(text, country) {
    // 1. 如果国家是中国，直接返回 true
    if (country === 'CN') return true;
    
    // 2. 检测文本中是否含有中文字符
    const chineseRegex = /[\u4e00-\u9fa5]/;
    return chineseRegex.test(text);
}

async function analyzeFeedbacks() {
    const conn = await pool.getConnection();
    
    try {
        // 1. 先查询待分析总数
        const [countResult] = await conn.execute(
            `SELECT COUNT(*) as total 
             FROM voc_feedbacks f
             JOIN voc_feedback_messages m ON f.id = m.feedback_id
             WHERE f.process_status = 'raw' 
               AND m.role = 'user' 
               AND m.sequence_num = 1`
        );
        const totalRemaining = countResult[0].total;
        
        if (totalRemaining === 0) {
            console.log("🎉 所有数据已分析完毕，暂无新数据。");
            return;
        }
        
        // 2. 获取待分析数据 
        const BATCH_SIZE = 5;
        const [rows] = await conn.execute(
            `SELECT f.id, f.app_name, f.country, m.content 
             FROM voc_feedbacks f
             JOIN voc_feedback_messages m ON f.id = m.feedback_id
             WHERE f.process_status = 'raw' 
               AND m.role = 'user' 
               AND m.sequence_num = 1
             ORDER BY f.id ASC 
             LIMIT ?`,
            [BATCH_SIZE.toString()]
        );

        console.log(`🔎 本批次待分析: ${rows.length} 条 | 剩余总数: ${totalRemaining} 条 (Start ID: ${rows[0].id})`);

        for (const item of rows) {
            const lang = isChinese(item.content, item.country) ? 'CN' : 'Other';
            process.stdout.write(`   🔄 [ID:${item.id}] ${item.app_name} (${item.country}, ${lang === 'CN' ? '中文' : '外文'})... `);
            
            try {
                // 设置 45秒 逻辑超时
                const analysis = await timeoutPromise(45000, callAI(item.content, item.country));
                
                // 更新主表
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

                // 只有当翻译不为空时才更新
                if (analysis.translated_text && analysis.translated_text.trim()) {
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
            }
        }
        
        conn.release();
        
        // 正常处理完一批，继续下一批
        await analyzeFeedbacks(); 

    } catch (fatalError) {
        console.error("💥 发生严重错误:", fatalError);
        console.log("⏳ 严重错误冷却：暂停 2 分钟...");
        await sleep(120000);
        await analyzeFeedbacks();
    } finally {
        conn.release();
    }
}

async function callAI(text, country) {
    if (!text || text.length < 2) return {};

    const isChineseText = isChinese(text, country);

    const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { 
                role: "user", 
                content: isChineseText 
                    ? `用户评论内容(中文):\n${text}\n\n注意: 原文已是中文，translated_text 字段留空即可。`
                    : `用户评论内容:\n${text}`
            }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
    });

    if (completion.usage) {
        await recordAICost('deepseek', MODEL_NAME, 'analysis', completion.usage);
    }

    try {
        const result = JSON.parse(completion.choices[0].message.content);
        
        // 如果是中文且 AI 错误地返回了翻译，清空它
        if (isChineseText && result.translated_text) {
            result.translated_text = '';
        }
        
        return result;
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