import gplay from 'google-play-scraper';
import pool from './db.js'; // 确保你已经在 src/db.js 导出了 pool

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
    num: 200 // 每次抓取最新的 200 条
};

// 辅助函数：休眠防止封IP
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        console.log(`✅ 抓取到 ${reviews.length} 条评论，准备入库...`);

        let newCount = 0;
        const conn = await pool.getConnection();

        try {
            for (const r of reviews) {
                // 1. 构造跳转链接
                const sourceUrl = `https://play.google.com/store/apps/details?id=${target.appId}&reviewId=${r.id}`;
                
                // 2. 尝试插入主表 (INSERT IGNORE 忽略已存在的 external_id)
                // 注意：这里 status 默认为 'raw'，等待 analyze.js 处理
                const [result] = await conn.execute(
                    `INSERT IGNORE INTO voc_feedbacks 
                     (source, external_id, source_url, app_id, app_name, country, version, 
                      user_name, rating, feedback_time, process_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')`,
                    [
                        'google_play', 
                        r.id, 
                        sourceUrl, 
                        target.appId, 
                        target.appName, 
                        target.country.toUpperCase(), 
                        r.version || 'Unknown', 
                        r.userName || 'Guest', 
                        r.score, 
                        new Date(r.date)
                    ]
                );

                // result.affectedRows > 0 表示这是一条新数据
                if (result.affectedRows > 0) {
                    newCount++;
                    const feedbackId = result.insertId;

                    // 3. 插入用户评论内容 (Role = user)
                    await conn.execute(
                        `INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content)
                         VALUES (?, 1, 'user', ?)`,
                        [feedbackId, r.text]
                    );

                    // 4. 如果开发者有回复，插入回复内容 (Role = agent)
                    if (r.replyText) {
                        await conn.execute(
                            `INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content)
                             VALUES (?, 2, 'agent', ?)`,
                            [feedbackId, r.replyText]
                        );
                        // 更新主表状态为已回复
                        await conn.execute(
                            'UPDATE voc_feedbacks SET is_replied = 1 WHERE id = ?', 
                            [feedbackId]
                        );
                    }
                }
            }
        } finally {
            conn.release();
        }

        console.log(`💾 入库完成: 新增 ${newCount} 条 (跳过 ${reviews.length - newCount} 条旧数据)`);

    } catch (error) {
        console.error(`❌ [${target.country}] 抓取失败:`, error.message);
    }
}

async function main() {
    console.log("=== 开始批量抓取任务 (MySQL版) ===");
    
    for (const target of APPS) {
        await fetchReviews(target);
        await sleep(2000); // 间隔2秒
    }
    
    console.log("\n✨ 所有任务执行完毕！请运行 'npm run analyze' 进行分析。");
    process.exit();
}

main();