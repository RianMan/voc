import gplay from 'google-play-scraper';
import pool from './db/index.js';
import { getAllApps } from './db/apps.js'; // 引入 DB 方法
import { fileURLToPath } from 'url';

const APP_CONFIGS = [
    {
        appId: 'com.mexicash.app',
        appName: 'MexiCash',
        views: [
            { country: 'mx', lang: 'es', label: 'MX_es' },
            { country: 'mx', lang: 'en', label: 'MX_en' },
        ]
    }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAllReviewsForView(appId, appName, view, startDate, endDate) {
    console.log(`\n🌍 [${view.label}] 抓取区间: ${startDate.toISOString().slice(0,10)} ~ ${endDate.toISOString().slice(0,10)}`);
    
    let allReviews = [];
    let nextToken = null;
    let pageNum = 1;
    let isFinished = false;
    let consecutiveMisses = 0; 
    const MAX_TOLERANCE = 100;

    try {
        while (!isFinished) {
            const response = await gplay.reviews({
                appId: appId,
                country: view.country,
                lang: view.lang,
                sort: gplay.sort.NEWEST,
                num: 150,
                nextPaginationToken: nextToken
            });

            const reviews = response.data || [];
            if (reviews.length === 0) break;

            for (const r of reviews) {
                const reviewDate = new Date(r.date);
                if (reviewDate > endDate) continue;
                if (reviewDate < startDate) {
                    consecutiveMisses++; 
                    if (consecutiveMisses >= MAX_TOLERANCE) {
                        isFinished = true;
                        break; 
                    }
                    continue;
                }
                consecutiveMisses = 0;
                allReviews.push(r);
            }

            nextToken = response.nextPaginationToken;
            pageNum++;
            if (pageNum > 50 || !nextToken) break; // 防止死循环
            await sleep(1000 + Math.random() * 1000);
        }
        return allReviews;
    } catch (error) {
        console.error(`❌ [${view.label}] 抓取失败:`, error.message);
        return allReviews;
    }
}

async function saveReviews(appId, appName, view, reviews) {
    if (reviews.length === 0) return 0;
    let newCount = 0;
    const conn = await pool.getConnection();

    try {
        for (const r of reviews) {
            const sourceUrl = `https://play.google.com/store/apps/details?id=${appId}&reviewId=${r.id}`;
            const [result] = await conn.execute(
                `INSERT IGNORE INTO voc_feedbacks 
                 (source, external_id, source_url, app_id, app_name, country, version, 
                  user_name, rating, feedback_time, process_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')`,
                ['google_play', r.id, sourceUrl, appId, appName, view.country.toUpperCase(), r.version || 'Unknown', r.userName || 'Guest', r.score, new Date(r.date)]
            );

            if (result.affectedRows > 0) {
                newCount++;
                const feedbackId = result.insertId;
                await conn.execute(`INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content) VALUES (?, 1, 'user', ?)`, [feedbackId, r.text]);
                if (r.replyText) {
                    await conn.execute(`INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content) VALUES (?, 2, 'agent', ?)`, [feedbackId, r.replyText]);
                    await conn.execute('UPDATE voc_feedbacks SET is_replied = 1 WHERE id = ?', [feedbackId]);
                }
            }
        }
    } catch (err) {
        console.error("入库出错:", err);
    } finally {
        conn.release();
    }
    console.log(`💾 [${view.label}] 入库完成: 新增 ${newCount} 条`);
    return newCount;
}

// ✅ 导出主函数
export async function runFetchGooglePlay(days = 7, manualAppConfig = null) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // 1. 决定要抓取哪些 App
    let appsToProcess = [];
    
    if (manualAppConfig) {
        // 如果是手动传入（比如从系统维护页面），只抓这就一个
        appsToProcess = [manualAppConfig];
    } else {
        // 否则从数据库加载所有配置
        console.log(`📡 [Fetch GP] 从数据库加载应用配置...`);
        const dbApps = await getAllApps();
        
        appsToProcess = dbApps.map(app => ({
            appId: app.app_id,
            appName: app.app_name,
            // 数据库里的 views 字段，如果为空则给个默认值
            views: app.views && app.views.length > 0 ? app.views : [
                { country: app.country.toLowerCase(), lang: 'es', label: `${app.country}_es` }
            ]
        }));
    }

    console.log(`🚀 [Fetch GP] 开始抓取 ${appsToProcess.length} 个应用, 最近 ${days} 天...`);

    for (const appConfig of appsToProcess) {
        for (const view of appConfig.views) {
            const reviews = await fetchAllReviewsForView(appConfig.appId, appConfig.appName, view, startDate, endDate);
            await saveReviews(appConfig.appId, appConfig.appName, view, reviews);
            await sleep(2000); // 休息一下
        }
    }
    return { success: true };
}

// ✅ 命令行自启动
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const days = process.argv[2] ? parseInt(process.argv[2]) : 7;
    runFetchGooglePlay(days)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}