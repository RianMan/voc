import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const UDESK_API = process.env.UDESK_API_URL || 'http://localhost:3999/backend/goapi/udesk/im-query';

const CHANNEL_TO_APP_MAP = {
  'Pinjamin': { appId: 'com.pinjamwinwin', country: 'ID' },
  'MexiCash': { appId: 'com.mexicash.app', country: 'MX' },
  'MocaMoca': { appId: 'com.mocamoca', country: 'PH' },
  'SmartQarza': { appId: 'com.creditcat.tech.app', country: 'PK' },
  'EASY สินเชื่อ': { appId: 'com.thai.credit.finance.reliable.loan.android', country: 'TH' }
};

async function fetchUdeskData(channel, startDate, endDate, page = 1) {
  const response = await fetch(UDESK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_time: `${startDate} 00:00:00`,
      end_time: `${endDate} 23:59:59`,
      customer_channel: channel,
      page,
      page_size: 100
    })
  });

  if (!response.ok) {
    throw new Error(`Udesk API error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.code !== 0) {
    throw new Error(`Udesk API error: ${result.message}`);
  }

  return result.data;
}

async function importUdeskSessions() {
  console.log('🚀 Starting Udesk IM data import...\n');

  const channels = Object.keys(CHANNEL_TO_APP_MAP);
  const weeks = [
    { start: '2025-11-25', end: '2025-12-01' },
    { start: '2025-12-02', end: '2025-12-08' },
    { start: '2025-12-09', end: '2025-12-15' },
    { start: '2025-12-16', end: '2025-12-22' }
  ];

  const conn = await pool.getConnection();
  let totalImported = 0;

  try {
    for (const channel of channels) {
      const appInfo = CHANNEL_TO_APP_MAP[channel];
      console.log(`\n📱 Processing ${channel}...`);

      for (const week of weeks) {
        console.log(`  📅 ${week.start} ~ ${week.end}`);

        const data = await fetchUdeskData(channel, week.start, week.end);
        const sessions = data.list || [];

        console.log(`    📥 Fetched ${sessions.length} sessions`);

        for (const session of sessions) {
          // 检查是否已存在
          const [exists] = await conn.query(
            'SELECT id FROM voc_feedbacks WHERE source = ? AND external_id = ?',
            ['udesk_chat', String(session.session_id)]
          );

          if (exists.length > 0) {
            continue;
          }

          // 插入主表
          const [result] = await conn.execute(
            `INSERT INTO voc_feedbacks 
             (source, external_id, source_url, app_id, app_name, country, 
              user_name, feedback_time, process_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'raw')`,
            [
              'udesk_chat',
              String(session.session_id),
              `https://udesk.example.com/session/${session.session_id}`,
              appInfo.appId,
              channel,
              appInfo.country,
              session.customer_name,
              new Date(session.session_created_at)
            ]
          );

          const feedbackId = result.insertId;

          // 插入消息（只插入用户消息用于AI分析）
          const userMessages = session.messages.filter(m => m.sender === 'customer');
          
          for (let i = 0; i < session.messages.length; i++) {
            const msg = session.messages[i];
            await conn.execute(
              `INSERT INTO voc_feedback_messages 
               (feedback_id, sequence_num, role, content)
               VALUES (?, ?, ?, ?)`,
              [
                feedbackId,
                i + 1,
                msg.sender === 'customer' ? 'user' : 'agent',
                msg.content_text
              ]
            );
          }

          totalImported++;
        }
      }
    }

    console.log(`\n✅ Import complete! Total: ${totalImported} sessions`);
  } catch (e) {
    console.error('❌ Import failed:', e);
  } finally {
    conn.release();
    process.exit();
  }
}

importUdeskSessions();