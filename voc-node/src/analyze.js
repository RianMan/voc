import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

const openai = new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
});

const SYSTEM_PROMPT = `
你是一个金融App的风控与VOC专家。你的任务是分析用户的评论。
请提取关键信息并返回JSON格式。

【分类定义】:
- Tech_Bug: 无法登录、崩溃、OTP收不到、上传失败、界面卡顿。
- Compliance_Risk: 提到 police(报警), court(法院), harass(骚扰), suicide(自杀), abuse(辱骂), call family(打给家人)。【最高优先级】
- Product_Issue: 抱怨利息高(high interest), 额度低, 期限短, 乱扣费。
- Positive: 好评。
- User_Error: 用户误操作。
- Other: 无意义内容。

【风险等级定义】:
- High: 涉及合规风险(Compliance_Risk)或严重Bug(无法还款/放款)。
- Medium: 普通Bug或强烈的利息抱怨。
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
    const payload = reviews.map(r => ({ id: r.id, text: r.text }));

    const userPrompt = `
    请分析以下评论，返回 JSON 数组。
    每个对象需包含: 
    "id", 
    "category" (Tech_Bug / Compliance_Risk / Product_Issue / Positive / User_Error / Other), 
    "summary" (中文一句话摘要), 
    "risk_level" (High/Medium/Low),
    "translated_text" (必须翻译！将评论翻译成通顺的简体中文)。

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
            temperature: 0.1
        });

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
                version: original?.version || "Unknown"
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