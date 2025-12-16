import OpenAI from 'openai';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';

dotenv.config();

// 使用阿里云 DashScope (千问)
const openai = new OpenAI({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.TONGYI_API_KEY, 
});

const AI_MODEL = 'qwen3-max'; // 性价比最高的千问模型

export async function runBatchAnalysis(batchSize = 20) {
    // 1. 捞取待处理数据
    const pendingItems = await prisma.feedback.findMany({
        where: { 
            OR: [
                { category: null },
                { status: 'PENDING' }
            ]
        },
        take: batchSize
    });

    if (pendingItems.length === 0) return { processed: 0 };

    console.log(`[AI] 正在使用 ${AI_MODEL} 分析 ${pendingItems.length} 条数据...`);

    // 2. 构造 Prompt (精简版)
    const payload = pendingItems.map(i => ({ 
        id: i.id, 
        text: i.content, 
        score: i.metaData?.score
    }));

    const systemPrompt = `你是一位资深的金融App体验专家。
    请分析用户反馈，返回一个 JSON 数组（不要包含 Markdown 格式）。
    数组对象包含：
    - "id": 原样返回
    - "category": [Tech_Bug, Compliance_Risk, Product_Issue, Positive, User_Error, Other]
    - "risk_level": [High, Medium, Low]
    - "translated_text": (中文) 翻译内容
    - "root_cause": (中文) 深度归因，用户为什么遇到这个问题？
    - "action_advice": (中文) 运营或产品改进建议
    - "suggested_reply": (当地语言) 建议回复
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: JSON.stringify(payload) }
            ],
            model: AI_MODEL,
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        // 解析结果
        const content = completion.choices[0].message.content;
        let results = [];
        try {
            const parsed = JSON.parse(content);
            results = Array.isArray(parsed) ? parsed : (parsed.reviews || parsed.data || []);
        } catch (e) {
            console.error("[AI] JSON 解析失败:", e.message);
            return { processed: 0, error: "JSON Parse Error" };
        }

        // 3. 回写数据库
        let successCount = 0;
        for (const res of results) {
            if (!res.id) continue;
            try {
                await prisma.feedback.update({
                    where: { id: res.id },
                    data: {
                        category: res.category,
                        riskLevel: res.risk_level,
                        translatedText: res.translated_text,
                        rootCause: res.root_cause,
                        actionAdvice: res.action_advice,
                        suggestedReply: res.suggested_reply,
                        status: 'CONFIRMED',
                        updatedAt: new Date()
                    }
                });
                successCount++;
            } catch (err) {
                console.error(`[DB] 更新 ID ${res.id} 失败`);
            }
        }

        console.log(`[AI] 批次完成: ${successCount}/${pendingItems.length} 条`);
        return { processed: successCount };

    } catch (error) {
        console.error("[AI] API 请求失败:", error.message);
        return { processed: 0, error: error.message };
    }
}