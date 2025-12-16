import gplay from 'google-play-scraper';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

// ==========================================
// 配置应用列表
// ==========================================
const APPS = [
    { country: 'pk', lang: 'ur', appId: 'com.creditcat.tech.app', appName: 'SmartQarza' },
    { country: 'mx', lang: 'es', appId: 'com.mexicash.app', appName: 'MexiCash' },
    { country: 'ph', lang: 'en', appId: 'com.mocamoca', appName: 'MocaMoca' },
    { country: 'id', lang: 'id', appId: 'com.pinjamwinwin', appName: 'Pinjamin' },
    { country: 'th', lang: 'th', appId: 'com.thai.credit.finance.reliable.loan.android', appName: 'EASY สินเชื่อ' }
];

const FETCH_CONFIG = {
    sort: gplay.sort.NEWEST,
    num: 200
};

// 确保目录存在
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// 生成安全的文件名
function sanitizeFilename(appId) {
    return appId.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function fetchReviews(target) {
    console.log(`\n🚀 开始抓取 [${target.country.toUpperCase()}] ${target.appName} (${target.appId})...`);
    
    try {
        const response = await gplay.reviews({
            appId: target.appId,
            country: target.country,
            language: target.lang,
            ...FETCH_CONFIG
        });

        const reviews = response.data;
        
        const enrichedReviews = reviews.map(r => ({
            ...r,
            country: target.country.toUpperCase(),
            appId: target.appId,
            appName: target.appName,
            version: r.version || 'Unknown'
        }));

        console.log(`✅ 成功抓取 ${enrichedReviews.length} 条评论`);

        const countryDir = path.join(DATA_DIR, target.country);
        ensureDir(countryDir);
        
        const filename = `raw_reviews_${sanitizeFilename(target.appId)}.json`;
        const filePath = path.join(countryDir, filename);
        
        fs.writeFileSync(filePath, JSON.stringify(enrichedReviews, null, 2));
        console.log(`💾 已保存: ${target.country}/${filename}`);

    } catch (error) {
        console.error(`❌ [${target.country}] 抓取失败:`, error.message);
    }
}

async function main() {
    console.log("=== 开始批量抓取任务 ===");
    
    for (const target of APPS) {
        await fetchReviews(target);
    }
    
    console.log("\n✨ 所有任务执行完毕！请运行 'npm run analyze' 进行分析。");
}

main();
