import gplay from 'google-play-scraper';
import pool from './db/index.js';

// ==========================================
// 配置：每个应用 × 多个语言视角
// ==========================================
const APP_CONFIGS = [
    // // 巴基斯坦
    // {
    //     appId: 'com.creditcat.tech.app',
    //     appName: 'SmartQarza',
    //     views: [
    //         { country: 'pk', lang: 'ur', label: 'PK_ur' },
    //         { country: 'pk', lang: 'en', label: 'PK_en' },
    //     ]
    // },
    // 墨西哥
    {
        appId: 'com.mexicash.app',
        appName: 'MexiCash',
        views: [
            { country: 'mx', lang: 'es', label: 'MX_es' },
            { country: 'mx', lang: 'en', label: 'MX_en' },
        ]
    },
    // 菲律宾
    // {
    //     appId: 'com.mocamoca',
    //     appName: 'MocaMoca',
    //     views: [
    //         { country: 'ph', lang: 'en', label: 'PH_en' },
    //         { country: 'ph', lang: 'tl', label: 'PH_tl' },
    //     ]
    // },
    // // 印尼
    // {
    //     appId: 'com.pinjamwinwin',
    //     appName: 'Pinjamin',
    //     views: [
    //         { country: 'id', lang: 'id', label: 'ID_id' },
    //         { country: 'id', lang: 'en', label: 'ID_en' },
    //     ]
    // },
    // // 泰国 - EASY สินเชื่อ
    // {
    //     appId: 'com.thai.credit.finance.reliable.loan.android',
    //     appName: 'EASY สินเชื่อ',
    //     views: [
    //         { country: 'th', lang: 'th', label: 'TH_th' },
    //         { country: 'th', lang: 'en', label: 'TH_en' },
    //     ]
    // },
    // // 泰国 - สินเชื่ออีซี่
    // {
    //     appId: 'com.reliablecredit.effectivecash.effectiveloan.android',
    //     appName: 'สินเชื่ออีซี่',
    //     views: [
    //         { country: 'th', lang: 'th', label: 'TH_th' },
    //         { country: 'th', lang: 'en', label: 'TH_en' },
    //     ]
    // },
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 👇 计算一个月前的日期
const ONE_MONTH_AGO = new Date();
ONE_MONTH_AGO.setMonth(ONE_MONTH_AGO.getMonth() - 1);

// ==========================================
// 核心函数：多视角分页抓取（带时间过滤）
// ==========================================
async function fetchAllReviewsForView(appId, appName, view) {
    console.log(`\n🌍 [${view.label}] 开始抓取 ${appName}...`);
    
    let allReviews = [];
    let nextToken = null;
    let pageNum = 1;
    const maxPages = 10;
    let shouldStop = false;

    try {
        do {
            console.log(`  📄 第 ${pageNum} 页...`);
            
            const response = await gplay.reviews({
                appId: appId,
                country: view.country,
                lang: view.lang,
                sort: gplay.sort.NEWEST, // 按最新排序
                num: 150,
                nextPaginationToken: nextToken
            });

            const reviews = response.data || [];
            
            // 👇 过滤：只保留最近一个月的评论
            const recentReviews = reviews.filter(r => {
                const reviewDate = new Date(r.date);
                return reviewDate >= ONE_MONTH_AGO;
            });

            console.log(`    ✓ 获取 ${reviews.length} 条，筛选后 ${recentReviews.length} 条（最近30天）`);

            // 如果本页没有符合条件的评论，说明后面都是旧数据，停止抓取
            if (recentReviews.length === 0) {
                console.log(`    ⚠️  已无最近30天的评论，停止抓取`);
                shouldStop = true;
                break;
            }

            allReviews = allReviews.concat(recentReviews);
            nextToken = response.nextPaginationToken;
            
            pageNum++;
            
            // 如果本页的最后一条评论已经超过30天，停止抓取
            const lastReviewDate = new Date(reviews[reviews.length - 1].date);
            if (lastReviewDate < ONE_MONTH_AGO) {
                console.log(`    ⚠️  本页最后一条评论已超过30天，停止抓取`);
                shouldStop = true;
                break;
            }

            if (!nextToken || pageNum > maxPages) {
                break;
            }

            await sleep(3000 + Math.random() * 2000);

        } while (nextToken && !shouldStop);

        console.log(`✅ [${view.label}] 总共抓取 ${allReviews.length} 条（最近30天）`);
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
    } finally {
        conn.release();
    }

    console.log(`✅ [${view.label}] 新增 ${newCount} 条 (跳过 ${reviews.length - newCount} 条重复)`);
}

async function main() {
    console.log("=== 多语言视角抓取任务（最近30天）===\n");
    console.log(`📅 时间范围: ${ONE_MONTH_AGO.toISOString().split('T')[0]} 至今\n`);
    
    for (const appConfig of APP_CONFIGS) {
        console.log(`\n📱 应用: ${appConfig.appName} (${appConfig.appId})`);
        console.log(`   视角数: ${appConfig.views.length}`);
        
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
            
            console.log(`   ⏱️  等待 5 秒...\n`);
            await sleep(5000);
        }
        
        console.log(`✨ ${appConfig.appName} 所有视角抓取完成！\n`);
    }
    
    console.log("🎉 全部任务执行完毕！");
    process.exit();
}

main();