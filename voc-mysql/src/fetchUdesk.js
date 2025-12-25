import pool from './db/index.js';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 配置区域 ====================

/**
 * 数据源配置
 * 每个国家一个 API 地址，包含该国家下的所有 channel（app）
 */
const DATA_SOURCES = [
  {
    country: 'CN',
    apiUrl: process.env.UDESK_API_CN || 'http://crm.kuainiu.io/backend/goapi/udesk/im-query-message',
    channels: [
      { name: '芸豆', appId: 'com.yundou.cn', appName: '芸豆' }
      // 未来可以添加中国区其他 app
    ]
  },
  // 未来其他国家的配置示例：
  // {
  //   country: 'PK',
  //   apiUrl: process.env.UDESK_API_PK || 'http://pk.example.com/api/udesk',
  //   channels: [
  //     { name: 'SmartQarza', appId: 'com.creditcat.tech.app', appName: 'SmartQarza' }
  //   ]
  // },
  // {
  //   country: 'MX',
  //   apiUrl: process.env.UDESK_API_MX || 'http://mx.example.com/api/udesk',
  //   channels: [
  //     { name: 'MexiCash', appId: 'com.mexicash.app', appName: 'MexiCash' }
  //   ]
  // }
];

// ==================== 核心函数 ====================

/**
 * 获取上周的日期范围
 */
function getLastWeekRange() {
  const today = new Date();
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - today.getDay() - 6); // 上周一
  lastMonday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6); // 上周日
  lastSunday.setHours(23, 59, 59, 999);
  
  return {
    start: lastMonday.toISOString().split('T')[0],
    end: lastSunday.toISOString().split('T')[0]
  };
}

/**
 * 调用 Udesk API 获取数据
 */
async function fetchUdeskPage(apiUrl, channel, startDate, endDate, page = 1, pageSize = 100) {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: `${startDate} 00:00:00`,
        end_time: `${endDate} 23:59:59`,
        customer_channel: channel,
        page,
        page_size: pageSize
      })
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(`API 返回错误: ${result.message}`);
    }

    return result.data;
  } catch (error) {
    console.error(`❌ 请求失败 [${channel}]:`, error.message);
    return null;
  }
}

/**
 * 分页获取所有会话数据
 */
async function fetchAllSessions(apiUrl, channel, startDate, endDate) {
  const allSessions = [];
  let page = 1;
  const pageSize = 100;
  
  console.log(`  📥 开始分页获取...`);
  
  while (true) {
    const data = await fetchUdeskPage(apiUrl, channel, startDate, endDate, page, pageSize);
    
    if (!data || !data.list || data.list.length === 0) {
      break;
    }
    
    allSessions.push(...data.list);
    console.log(`    第 ${page} 页: ${data.list.length} 条 (总计 ${allSessions.length}/${data.total})`);
    
    // 如果已经获取所有数据，退出
    if (allSessions.length >= data.total) {
      break;
    }
    
    page++;
  }
  
  return allSessions;
}

/**
 * 保存会话到数据库
 */
async function saveSessions(sessions, channel, appId, appName, country) {
  if (sessions.length === 0) {
    console.log(`  ⚠️  无数据可保存`);
    return 0;
  }

  console.log(`  💾 开始入库 ${sessions.length} 条会话...`);
  
  let newCount = 0;
  const conn = await pool.getConnection();

  try {
    for (const session of sessions) {
      // 检查是否已存在
      const [exists] = await conn.query(
        'SELECT id FROM voc_feedbacks WHERE source = ? AND external_id = ?',
        ['udesk_chat', String(session.session_id)]
      );

      if (exists.length > 0) {
        continue; // 跳过重复数据
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
          `https://udesk.example.com/session/${session.session_id}`, // 可以配置实际的工单链接
          appId,
          appName,
          country,
          session.customer_name || 'Guest',
          new Date(session.session_created_at)
        ]
      );

      const feedbackId = result.insertId;

      // 插入所有消息（保留完整对话）
      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        
        // 跳过系统消息
        if (msg.sender === 'sys') {
          continue;
        }
        
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

      newCount++;
    }
    
    console.log(`  ✅ 新增 ${newCount} 条 (跳过 ${sessions.length - newCount} 条重复)`);
    return newCount;
  } catch (error) {
    console.error(`  ❌ 入库失败:`, error.message);
    return 0;
  } finally {
    conn.release();
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始 Udesk 数据同步任务\n');
  
  // 获取上周日期范围
  const { start, end } = getLastWeekRange();
  console.log(`📅 时间范围: ${start} ~ ${end}\n`);
  
  let totalImported = 0;
  
  // 遍历所有数据源
  for (const source of DATA_SOURCES) {
    console.log(`\n🌍 国家: ${source.country} (${source.apiUrl})`);
    
    // 遍历该国家下的所有 channel
    for (const channel of source.channels) {
      console.log(`\n📱 Channel: ${channel.name}`);
      
      try {
        // 1. 获取数据
        const sessions = await fetchAllSessions(
          source.apiUrl, 
          channel.name, 
          start, 
          end
        );
        
        // 2. 保存数据
        const imported = await saveSessions(
          sessions,
          channel.name,
          channel.appId,
          channel.appName,
          source.country
        );
        
        totalImported += imported;
        
      } catch (error) {
        console.error(`❌ ${channel.name} 处理失败:`, error.message);
      }
    }
  }
  
  console.log(`\n\n🎉 同步完成！总计导入 ${totalImported} 条新会话`);
  process.exit(0);
}

// 执行
main().catch(error => {
  console.error('💥 任务失败:', error);
  process.exit(1);
});