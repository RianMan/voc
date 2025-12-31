import pool from './db/connection.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const DEFAULT_UDESK_API_URL = 'http://biz-crm.mxgbus.com/backend/goapi/udesk/im-query-message';

const UDESK_CONFIG_BASE = {
    apiUrl: 'http://biz-crm.mxgbus.com/backend/goapi/udesk/im-query-message',
    channels: [{ name: 'MexiCash', appId: 'com.mexicash.app', appName: 'MexiCash', country: 'MX' }]
};

function formatTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function splitTimeRange(startStr, endStr) {
    const chunks = [];
    let currentStart = new Date(startStr);
    const globalEnd = new Date(endStr);
    while (currentStart < globalEnd) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 7); 
        if (currentEnd > globalEnd) {
            currentEnd = new Date(globalEnd);
            currentEnd.setHours(23, 59, 59);
        } else {
            currentEnd.setHours(23, 59, 59);
        }
        chunks.push({ start: formatTime(currentStart), end: formatTime(currentEnd) });
        currentStart = new Date(currentEnd);
        currentStart.setSeconds(currentStart.getSeconds() + 1);
    }
    return chunks;
}

async function fetchUdeskPage(apiUrl, channelName, startDate, endDate, page = 1) {
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_time: startDate, end_time: endDate, customer_channel: channelName, page, page_size: 100 })
        });
        const json = await response.json();
        if (json.code !== 0) return null;
        return json.data;
    } catch (e) {
        return null;
    }
}

async function saveSessions(sessions, appConfig) {
    if (!sessions || sessions.length === 0) return 0;
    let count = 0;
    const conn = await pool.getConnection();
    try {
        for (const session of sessions) {
            const userMsg = session.messages.find(m => m.sender === 'customer' && (m.content_type === 'message' || m.content_type === 'text'));
            const mainContent = userMsg ? userMsg.content_text : '(无文本)';
            const [res] = await conn.execute(`
                INSERT IGNORE INTO voc_feedbacks 
                (source, external_id, source_url, app_id, app_name, country, user_name, content, feedback_time, process_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')
            `, ['udesk_chat', String(session.session_id), '', appConfig.appId, appConfig.appName, appConfig.country, session.customer_name || 'Guest', mainContent, new Date(session.session_created_at)]);

            if (res.affectedRows > 0) {
                count++;
                const feedbackId = res.insertId;
                for (const msg of session.messages) {
                    if (msg.sender === 'sys') continue; 
                    await conn.execute(`INSERT INTO voc_feedback_messages (feedback_id, role, content) VALUES (?, ?, ?)`, [feedbackId, msg.sender === 'customer' ? 'user' : 'agent', msg.content_text]);
                }
            }
        }
    } catch (e) { console.error(e); } finally { conn.release(); }
    return count;
}

// ✅ 导出主函数
export async function runFetchUdesk(days = 7, manualAppConfig = null) {
    const endDt = new Date();
    const startDt = new Date();
    startDt.setDate(endDt.getDate() - days);
    endDt.setHours(23, 59, 59); startDt.setHours(0, 0, 0);

    const startTimeStr = formatTime(startDt);
    const endTimeStr = formatTime(endDt);
    const timeChunks = splitTimeRange(startTimeStr, endTimeStr);

    let appsToProcess = [];

    if (manualAppConfig) {
        appsToProcess = [manualAppConfig];
    } else {
        // 从数据库加载
        console.log(`📡 [Fetch Udesk] 从数据库加载应用配置...`);
        appsToProcess = await getAllApps();
    }

    console.log(`🚀 [Fetch Udesk] 开始任务 (${startTimeStr} ~ ${endTimeStr})`);

    for (const app of appsToProcess) {
        // ✅ 核心逻辑：获取 Udesk 配置
        const udeskConfig = app.udesk_config || {};
        // 优先用配置的 URL，没有就用默认的
        const apiUrl = udeskConfig.apiUrl || DEFAULT_UDESK_API_URL;
        // 优先用配置的 Channel，没有就用 AppName
        const channelName = udeskConfig.channel || app.app_name;

        if (!apiUrl) {
            console.log(`⚠️  [${app.app_name}] 未配置 Udesk URL，跳过`);
            continue;
        }

        console.log(`   📱 [${app.app_name}] Channel: ${channelName} | URL: ${apiUrl}`);

        // 开始抓取循环
        for (const chunk of timeChunks) {
            let page = 1;
            let hasNext = true;
            while (hasNext) {
                // 传入动态 apiUrl
                const data = await fetchUdeskPage(apiUrl, channelName, chunk.start, chunk.end, page);
                if (!data || !data.list || data.list.length === 0) {
                    hasNext = false;
                    break;
                }
                const saved = await saveSessions(data.list, app);
                process.stdout.write(`      +${saved} `);
                if (data.list.length < 100) hasNext = false;
                else page++;
            }
            console.log('');
        }
    }
    return { success: true };
}

// ✅ 命令行自启动
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const days = process.argv[2] ? parseInt(process.argv[2]) : 7;
    runFetchUdesk(days)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}