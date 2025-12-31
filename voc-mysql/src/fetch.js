import gplay from 'google-play-scraper';
import pool from './db/index.js';

// ==========================================
// 1. 配置：时间范围 (2025 Q4)
// ==========================================
const START_DATE = new Date('2025-09-30T16:00:00.000Z'); // 北京时间 10.1 00:00
const END_DATE   = new Date('2025-12-31T16:00:00.000Z'); // 北京时间 2026.1.1 00:00

// ==========================================
// 2. 配置：应用列表
// ==========================================
const APP_CONFIGS = [
    // 墨西哥
    {
        appId: 'com.mexicash.app',
        appName: 'MexiCash',
        views: [
            { country: 'mx', lang: 'es', label: 'MX_es' },
            { country: 'mx', lang: 'en', label: 'MX_en' },
        ]
    },
    // 你可以在这里把其他的 APP 注释打开
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 核心函数：带容错机制的抓取
// ==========================================
async function fetchAllReviewsForView(appId, appName, view) {
    console.log(`\n🌍 [${view.label}] 开始抓取 ${appName}...`);
    console.log(`   🎯 目标区间: ${START_DATE.toISOString()} ~ ${END_DATE.toISOString()}`);
    
    let allReviews = [];
    let nextToken = null;
    let pageNum = 1;
    let isFinished = false;
    
    // 容错计数器：连续遇到多少条旧数据
    let consecutiveMisses = 0; 
    const MAX_TOLERANCE = 150; // 如果连续 150 条（一整页）都是旧数据，才停止

    try {
        while (!isFinished) {
            console.log(`  📄 第 ${pageNum} 页... (当前已收集: ${allReviews.length})`);
            
            const response = await gplay.reviews({
                appId: appId,
                country: view.country,
                lang: view.lang,
                sort: gplay.sort.NEWEST, // 依然请求最新，这是最高效的
                num: 150,
                nextPaginationToken: nextToken
            });

            const reviews = response.data || [];

            if (reviews.length === 0) {
                console.log(`    🛑 API 返回空数据，停止。`);
                break;
            }

            let pageValidCount = 0;

            for (const r of reviews) {
                const reviewDate = new Date(r.date);

                // 1. 如果比结束时间还晚（未来的数据，虽然不太可能），跳过
                if (reviewDate > END_DATE) {
                    continue;
                }

                // 2. 如果比开始时间早（旧数据）
                if (reviewDate < START_DATE) {
                    consecutiveMisses++; 
                    // 只有当连续一整页都是旧数据时，才真的停止
                    if (consecutiveMisses >= MAX_TOLERANCE) {
                        console.log(`    🛑 触底: 连续 ${MAX_TOLERANCE} 条数据早于起始日期，停止抓取。`);
                        isFinished = true;
                        break; 
                    }
                    continue; // 跳过这条旧数据，继续看下一条
                }

                // 3. 有效数据（在区间内）
                consecutiveMisses = 0; // 重置计数器！说明数据流又回到正常时间了
                allReviews.push(r);
                pageValidCount++;
            }

            console.log(`    ✓ 本页入选 ${pageValidCount} 条`);

            nextToken = response.nextPaginationToken;
            pageNum++;

            // 安全限制：防止死循环，比如最多抓 100 页
            if (pageNum > 100) { 
                console.log('    ⚠️ 达到最大页数限制，强制停止');
                break; 
            }

            if (!nextToken) {
                console.log('    🛑 无下一页 token，停止');
                break;
            }

            // 随机延时
            await sleep(2000 + Math.random() * 1000);
        }

        console.log(`✅ [${view.label}] 最终有效抓取 ${allReviews.length} 条`);
        return allReviews;

    } catch (error) {
        console.error(`❌ [${view.label}] 抓取失败:`, error.message);
        return allReviews;
    }
}

async function saveReviews(appId, appName, view, reviews) {
    if (reviews.length === 0) {
        console.log(`⚠️  [${view.label}] 无数据可入库`);
        return;
    }

    console.log(`💾 [${view.label}] 开始入库 ${reviews.length} 条...`);
    
    let newCount = 0;
    const conn = await pool.getConnection();

    try {
        for (const r of reviews) {
            const sourceUrl = `https://play.google.com/store/apps/details?id=${appId}&reviewId=${r.id}`;
            
            // 确保把 gplay 里的字段映射正确
            // gplay 返回的 id 是 r.id
            // gplay 返回的 text 是 r.text
            // gplay 返回的 score 是 r.score
            
            const [result] = await conn.execute(
                `INSERT IGNORE INTO voc_feedbacks 
                 (source, external_id, source_url, app_id, app_name, country, version, 
                  user_name, rating, feedback_time, process_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')`,
                [
                    'google_play', 
                    r.id, 
                    sourceUrl, 
                    appId, 
                    appName, 
                    view.country.toUpperCase(), 
                    r.version || 'Unknown', 
                    r.userName || 'Guest', 
                    r.score, 
                    new Date(r.date)
                ]
            );

            if (result.affectedRows > 0) {
                newCount++;
                const feedbackId = result.insertId;

                await conn.execute(
                    `INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content)
                     VALUES (?, 1, 'user', ?)`,
                    [feedbackId, r.text]
                );

                if (r.replyText) {
                    await conn.execute(
                        `INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content)
                         VALUES (?, 2, 'agent', ?)`,
                        [feedbackId, r.replyText]
                    );
                    await conn.execute(
                        'UPDATE voc_feedbacks SET is_replied = 1 WHERE id = ?', 
                        [feedbackId]
                    );
                }
            }
        }
    } catch (err) {
        console.error("入库出错:", err);
    } finally {
        conn.release();
    }

    console.log(`✅ [${view.label}] 新增 ${newCount} 条 (跳过 ${reviews.length - newCount} 条重复)`);
}

async function main() {
    console.log("=== 多语言视角抓取任务 (2025 Q4) ===\n");
    
    for (const appConfig of APP_CONFIGS) {
        console.log(`\n📱 应用: ${appConfig.appName} (${appConfig.appId})`);
        
        for (const view of appConfig.views) {
            const reviews = await fetchAllReviewsForView(
                appConfig.appId, 
                appConfig.appName, 
                view
            );
            
            await saveReviews(
                appConfig.appId, 
                appConfig.appName, 
                view, 
                reviews
            );
            
            console.log(`   ⏱️  等待 3 秒...\n`);
            await sleep(3000);
        }
    }
    
    console.log("🎉 全部任务执行完毕！");
    process.exit();
}

main();