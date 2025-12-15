import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { recordAICost } from './db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

const openai = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
});

const SYSTEM_PROMPT = `
你是一位资深的金融App产品经理和用户体验专家。你的核心能力不仅仅是总结评论，而是通过用户反馈洞察产品设计缺陷、运营流程漏洞或合规风险。

请提取关键信息并返回JSON格式。

【分类定义】:
- Tech_Bug: 无法登录、崩溃、OTP问题、界面卡顿。
- Compliance_Risk: 威胁、恐吓、骚扰、联系家人、非法、报警、监管投诉。【最高优先级】
- Product_Issue: 流程费解(如下单误解)、无法取消、额度/利息抱怨、扣费不明。
- Positive: 好评。
- User_Error: 用户误操作。
- Other: 无意义内容。

【风险等级定义】:
- High: 合规风险、资金损失、严重阻断性Bug。
- Medium: 强烈的体验抱怨（如误操作导致贷款）、利息抱怨。
- Low: 其他。
`;

// 递归扫描所有 raw_reviews_*.json 文件
function scanRawFiles(dir) {
    const results = [];
    
    if (!fs.existsSync(dir)) return results;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            // 递归扫描子目录
            results.push(...scanRawFiles(fullPath));
        } else if (entry.isFile() && entry.name.startsWith('raw_reviews_') && entry.name.endsWith('.json')) {
            results.push(fullPath);
        }
    }
    
    return results;
}

async function analyzeFile(rawFilePath) {
    // 输出文件放在同目录: raw_reviews_xxx.json -> analyzed_xxx.json
    const dir = path.dirname(rawFilePath);
    const basename = path.basename(rawFilePath);
    const outputFilename = basename.replace('raw_reviews_', 'analyzed_');
    const outputFilePath = path.join(dir, outputFilename);
    
    const relativePath = path.relative(DATA_DIR, rawFilePath);
    console.log(`\n📂 正在处理: ${relativePath}`);

    const rawData = JSON.parse(fs.readFileSync(rawFilePath, 'utf8'));
    
    // 预处理过滤
    const validReviews = rawData.filter(r => {
        const text = r.text || "";
        if (text.length < 3) return false;
        if (r.score === 5 && text.length < 5) return false;
        return true;
    });

    console.log(`   待分析条数: ${validReviews.length}`);

    const BATCH_SIZE = 10;
    let allResults = [];

    for (let i = 0; i < validReviews.length; i += BATCH_SIZE) {
        const batch = validReviews.slice(i, i + BATCH_SIZE);
        process.stdout.write(`   🔄 批次 [${Math.ceil((i+1)/BATCH_SIZE)}/${Math.ceil(validReviews.length/BATCH_SIZE)}] 分析中... \r`);

        const analysis = await analyzeBatch(batch);
        allResults = allResults.concat(analysis);
    }

    fs.writeFileSync(outputFilePath, JSON.stringify(allResults, null, 2));
    console.log(`\n   ✅ 完成! 报告: ${path.relative(DATA_DIR, outputFilePath)}`);
    return allResults.length;
}

async function analyzeBatch(reviews) {
    const payload = reviews.map(r => ({ 
        id: r.id, 
        text: r.text,
        score: r.score // 传入评分
    }));

    const userPrompt = `
    请深度分析以下用户评论，返回 JSON 数组。
    每个对象需包含: 
    "id", 
    "category" (Tech_Bug / Compliance_Risk / Product_Issue / Positive / User_Error / Other), 
    "summary" (中文一句话摘要，例如：用户误以为填表单是验额度，结果直接放款了), 
    "risk_level" (High/Medium/Low),
    "translated_text" (翻译成通顺的简体中文),
    
    // 新增：深度分析字段
    "root_cause": (中文，深度归因。分析用户为什么会遇到这个问题？例如：下单按钮文案有歧义、防诈骗提示不明显、催收话术过激),
    "action_advice": (中文，行动建议。针对产品或运营的具体优化策略。例如：建议将“申请”按钮改为“确认提现”、增加二次确认弹窗、核查代理商ID),
    
    // 新增：高情商回复
    "suggested_reply": (当地语言回复。要求：1. 极度共情，像真人一样对话；2. 必须引用用户提到的具体细节（如“360天”、“800额度”）；3. 严禁使用“We sincerely apologize”等机械套话，直接说人话；4. 给出具体指引。)

    评论数据:
    ${JSON.stringify(payload)}
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ],
            model: "deepseek-chat",
            response_format: { type: "json_object" },
            temperature: 0.2
        });

        if (completion.usage) {
            const cost = recordAICost('deepseek', 'deepseek-chat', 'analysis', completion.usage);
            console.log(`   💰 本批次花费: ¥${cost.toFixed(4)}`);
        }

        const content = completion.choices[0].message.content;
        let aiResults = [];
        
        try {
            const parsed = JSON.parse(content);
            aiResults = Array.isArray(parsed) ? parsed : (parsed.reviews || parsed.data || []);
        } catch (e) {
            console.error("\n   ⚠️ JSON 解析失败，跳过本批次");
            return [];
        }

        // 合并原始数据
        const mergedResults = aiResults.map(result => {
            const original = reviews.find(r => r.id === result.id);
            return {
                ...result,
                text: original?.text || "",
                score: original?.score || 0,
                date: original?.date || null,
                country: original?.country || "Unknown",
                appId: original?.appId || "Unknown",
                appName: original?.appName || "",
                version: original?.version || "Unknown",
                replyText: original?.replyText || null, // GP 上已有的回复
                replyDate: original?.replyDate || null
            };
        });

        return mergedResults;

    } catch (error) {
        console.error("\n   ⚠️ AI 请求失败:", error.message);
        return [];
    }
}

async function main() {
    const rawFiles = scanRawFiles(DATA_DIR);

    if (rawFiles.length === 0) {
        console.error("❌ 没有找到原始数据文件，请先运行 'npm run fetch'");
        return;
    }

    console.log(`🔎 发现 ${rawFiles.length} 个数据文件待处理...`);

    for (const file of rawFiles) {
        await analyzeFile(file);
    }
    
    console.log("\n✨ 全部分析完成！");
}

main();