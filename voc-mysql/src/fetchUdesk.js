import pool from './db/connection.js';
import dotenv from 'dotenv';

dotenv.config();

// ================= 配置区域 =================

const UDESK_CONFIG = {
    // ✅ 修正 1: 更新为真实的生产环境 API 地址
    apiUrl: 'http://biz-crm.mxgbus.com/backend/goapi/udesk/im-query-message',
    channels: [
        { name: 'MexiCash', appId: 'com.mexicash.app', appName: 'MexiCash', country: 'MX' }
    ]
};

// ✅ 修正 2: 获取"本月"的时间范围 (从本月1号到今天)
function getDateRange() {
    const now = new Date();
    // 本月第一天
    const start = new Date(now.getFullYear(), now.getMonth(), 1); 
    // 今天 (结束时间)
    const end = new Date(); 
    
    // 格式化为 YYYY-MM-DD
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    return {
        start: formatDate(start),
        end: formatDate(end)
    };
}

// ================= 核心逻辑 =================

async function fetchUdeskPage(apiUrl, channelName, startDate, endDate, page = 1) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_time: `${startDate} 00:00:00`,
                end_time: `${endDate} 23:59:59`,
                customer_channel: channelName,
                page,
                page_size: 100 // 每页抓100条
            })
        });
        const json = await response.json();
        return json.code === 0 ? json.data : null;
    } catch (e) {
        console.error('API Error:', e.message);
        return null;
    }
}

async function saveSessions(sessions, appConfig) {
    if (!sessions || sessions.length === 0) return 0;
    
    let count = 0;
    const conn = await pool.getConnection();
    
    try {
        for (const session of sessions) {
            // ✅ 修正 3: 适配真实数据结构
            // 真实数据的 content_type 是 "message" 而不是 "text"
            const userMsg = session.messages.find(m => 
                m.sender === 'customer' && 
                (m.content_type === 'message' || m.content_type === 'text')
            );
            
            // 如果没找到用户发的消息，给一个默认提示，防止内容为空
            const mainContent = userMsg ? userMsg.content_text : '(用户发送了图片/语音或无发言)';

            // 1. 插入主表 (IGNORE 避免重复，基于 source + external_id)
            const [res] = await conn.execute(`
                INSERT IGNORE INTO voc_feedbacks 
                (source, external_id, source_url, app_id, app_name, country, 
                 user_name, content, feedback_time, process_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')
            `, [
                'udesk_chat',
                String(session.session_id),
                '', // Udesk工单链接暂时留空，或者你可以自己拼一个后台链接
                appConfig.appId,
                appConfig.appName,
                appConfig.country,
                session.customer_name || 'Guest',
                mainContent, // 这是分析脚本主要看的内容
                new Date(session.session_created_at)
            ]);

            // 只有当是新插入的数据时，才处理消息详情 (affectedRows > 0)
            if (res.affectedRows > 0) {
                count++;
                const feedbackId = res.insertId;

                // 2. 插入完整对话记录 (保留上下文)
                for (const msg of session.messages) {
                    // 跳过系统自动回复，保留 agent(客服) 和 customer(用户)
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
    const { start, end } = getDateRange();
    console.log(`🚀 开始抓取 Udesk 数据 (${start} ~ ${end})...`);

    for (const channel of UDESK_CONFIG.channels) {
        console.log(`\n📱 正在处理渠道: ${channel.name}`);
        let page = 1;
        
        while (true) {
            const data = await fetchUdeskPage(UDESK_CONFIG.apiUrl, channel.name, start, end, page);
            
            if (!data || !data.list || data.list.length === 0) {
                console.log('   - 无更多数据');
                break;
            }

            const saved = await saveSessions(data.list, channel);
            console.log(`   - 第 ${page} 页: 获取 ${data.list.length} 条，新入库 ${saved} 条`);
            
            // 如果当前页不满 100 条，或者已经到了最后一页
            if (data.list.length < 100 || page * 100 >= data.total) {
                break; 
            }
            page++;
        }
    }
    console.log('\n✅ Udesk 同步完成！现在可以运行 node src/analyze.js 进行分析了。');
    process.exit(0);
}

main();