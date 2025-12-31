import pool from './db/connection.js'; // 确保路径对
import dotenv from 'dotenv';

dotenv.config();

// ================= 配置区域 =================

const UDESK_CONFIG = {
    apiUrl: 'http://biz-crm.mxgbus.com/backend/goapi/udesk/im-query-message',
    channels: [
        { name: 'MexiCash', appId: 'com.mexicash.app', appName: 'MexiCash', country: 'MX' }
    ],
    // 这里依然可以写长跨度，代码会自动切分
    startTime: '2025-10-01 00:00:00',
    endTime:   '2025-12-31 23:59:59' 
};

// ================= 工具函数 =================

// 格式化日期为 YYYY-MM-DD HH:mm:ss
function formatTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// 核心：将大时间段切分为多个 30 天的小片段
function splitTimeRange(startStr, endStr) {
    const chunks = [];
    let currentStart = new Date(startStr);
    const globalEnd = new Date(endStr);
    
    while (currentStart < globalEnd) {
        // 👇 修改这里：把 30 改成 7 (或者 15)
        // 这样每个请求只查 7 天的数据，绝对不会报错
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 7); 
        
        // 如果超出了总结束时间，就用总结束时间
        if (currentEnd > globalEnd) {
            currentEnd = new Date(globalEnd);
        } else {
            // 保持 23:59:59
            currentEnd.setHours(23, 59, 59);
        }

        chunks.push({
            start: formatTime(currentStart),
            end: formatTime(currentEnd)
        });

        // 下一段的开始 = 当前结束 + 1秒
        currentStart = new Date(currentEnd);
        currentStart.setSeconds(currentStart.getSeconds() + 1);
    }
    return chunks;
}

// ================= 核心逻辑 =================

async function fetchUdeskPage(apiUrl, channelName, startDate, endDate, page = 1) {
    try {
        const bodyParams = {
            start_time: startDate,
            end_time: endDate,
            customer_channel: channelName,
            page,
            page_size: 100
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyParams)
        });
        
        const json = await response.json();
        
        if (json.code !== 0) {
            console.error(`   ❌ API 报错 (Page ${page}): ${json.message}`);
            return null;
        }

        return json.data;
    } catch (e) {
        console.error('   ❌ 网络错误:', e.message);
        return null;
    }
}

async function saveSessions(sessions, appConfig) {
    if (!sessions || sessions.length === 0) return 0;
    
    let count = 0;
    const conn = await pool.getConnection();
    
    try {
        for (const session of sessions) {
            // 查找用户发送的有效文本
            const userMsg = session.messages.find(m => 
                m.sender === 'customer' && 
                (m.content_type === 'message' || m.content_type === 'text')
            );
            
            const mainContent = userMsg ? userMsg.content_text : '(图片/语音/无文本)';

            // 1. 插入主表
            const [res] = await conn.execute(`
                INSERT IGNORE INTO voc_feedbacks 
                (source, external_id, source_url, app_id, app_name, country, 
                 user_name, content, feedback_time, process_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')
            `, [
                'udesk_chat',
                String(session.session_id),
                '', 
                appConfig.appId,
                appConfig.appName,
                appConfig.country,
                session.customer_name || 'Guest',
                mainContent,
                new Date(session.session_created_at)
            ]);

            if (res.affectedRows > 0) {
                count++;
                const feedbackId = res.insertId;

                // 2. 插入对话详情
                for (const msg of session.messages) {
                    if (msg.sender === 'sys') continue; 
                    
                    await conn.execute(`
                        INSERT INTO voc_feedback_messages (feedback_id, role, content)
                        VALUES (?, ?, ?)
                    `, [
                        feedbackId,
                        msg.sender === 'customer' ? 'user' : 'agent',
                        msg.content_text
                    ]);
                }
            }
        }
    } catch (e) {
        console.error('入库失败:', e);
    } finally {
        conn.release();
    }
    return count;
}

async function main() {
    console.log(`🚀 开始抓取 Udesk 数据 (总区间: ${UDESK_CONFIG.startTime} ~ ${UDESK_CONFIG.endTime})`);

    // 1. 切分时间段
    const timeChunks = splitTimeRange(UDESK_CONFIG.startTime, UDESK_CONFIG.endTime);
    console.log(`📅 时间跨度过长，已自动拆分为 ${timeChunks.length} 个 30 天的时间块进行抓取。\n`);

    for (const channel of UDESK_CONFIG.channels) {
        console.log(`📱 [${channel.name}] 准备开始...`);

        // 2. 遍历每一个时间块
        for (const chunk of timeChunks) {
            console.log(`   ⏳ 正在抓取时间段: ${chunk.start} ~ ${chunk.end}`);
            
            let page = 1;
            let hasNext = true;

            // 3. 在当前时间块内翻页
            while (hasNext) {
                const data = await fetchUdeskPage(
                    UDESK_CONFIG.apiUrl, 
                    channel.name, 
                    chunk.start, 
                    chunk.end, 
                    page
                );
                
                if (!data || !data.list || data.list.length === 0) {
                    // console.log('      - 本页无数据，跳至下一时间段');
                    hasNext = false;
                    break;
                }

                const saved = await saveSessions(data.list, channel);
                
                // 只有当真的有数据入库或者数据量大时才打印，减少刷屏
                if (data.list.length > 0) {
                     console.log(`      -> 第 ${page} 页: 获取 ${data.list.length} 条 | 新入库 ${saved} 条`);
                }

                // 翻页终止条件
                if (data.list.length < 100 || (data.total > 0 && page * 100 >= data.total)) {
                    hasNext = false;
                } else {
                    page++;
                }
            }
        }
    }
    console.log('\n✅ Udesk 同步完成！');
    process.exit(0);
}

main();