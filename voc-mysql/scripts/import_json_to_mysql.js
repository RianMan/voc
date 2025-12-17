import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

// 数据库配置 (保持和你项目一致)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'voc_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 递归查找所有 JSON 文件
function scanFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(scanFiles(filePath));
        } else if (file.startsWith('analyzed_') && file.endsWith('.json')) {
            // 只导入 analyzed 的文件，因为包含分析结果
            results.push(filePath);
        }
    });
    return results;
}

async function importData() {
    const files = scanFiles(DATA_DIR);
    console.log(`🔎 找到 ${files.length} 个数据文件，准备导入...`);

    const conn = await pool.getConnection();

    try {
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            let reviews = [];
            try {
                reviews = JSON.parse(content);
                // 兼容数组或对象结构
                if (reviews.data) reviews = reviews.data; 
                if (!Array.isArray(reviews)) continue;
            } catch (e) {
                console.error(`❌ 解析失败: ${file}`);
                continue;
            }

            console.log(`📄 正在导入 ${path.basename(file)} (${reviews.length} 条)...`);

            for (const r of reviews) {
                // 1. 插入主表
                const source = 'google_play';
                const externalId = r.id; // GP 的 reviewId
                
                // 构造 GP 链接
                const sourceUrl = r.url || `https://play.google.com/store/apps/details?id=${r.appId}&reviewId=${r.id}`;
                
                // 检查是否存在
                const [exists] = await conn.query(
                    'SELECT id FROM voc_feedbacks WHERE source = ? AND external_id = ?', 
                    [source, externalId]
                );

                if (exists.length > 0) {
                    continue; // 跳过已存在的
                }

                // 准备插入 voc_feedbacks
                const [res] = await conn.execute(
                    `INSERT INTO voc_feedbacks 
                    (source, external_id, source_url, app_id, app_name, country, version, 
                     user_name, rating, category, risk_level, summary, root_cause, 
                     action_advice, suggested_reply, process_status, is_replied, feedback_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        source,
                        externalId,
                        sourceUrl,
                        r.appId || 'Unknown',
                        r.appName || '',
                        r.country || 'Unknown',
                        r.version || 'Unknown',
                        r.userName || 'Guest',
                        r.score || 0,
                        r.category || null,
                        r.risk_level || 'Low',
                        r.summary || '',
                        r.root_cause || '',
                        r.action_advice || '',
                        r.suggested_reply || '',
                        'analyzed', // 因为是从 analyzed 文件导入的
                        r.replyText ? 1 : 0,
                        new Date(r.date || Date.now())
                    ]
                );

                const feedbackId = res.insertId;

                // 2. 插入消息表 - 用户评论
                await conn.execute(
                    `INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content, translated_content)
                     VALUES (?, 1, 'user', ?, ?)`,
                    [feedbackId, r.text || '', r.translated_text || '']
                );

                // 3. 插入消息表 - 官方回复 (如果有)
                if (r.replyText) {
                    await conn.execute(
                        `INSERT INTO voc_feedback_messages (feedback_id, sequence_num, role, content)
                         VALUES (?, 2, 'agent', ?)`,
                        [feedbackId, r.replyText]
                    );
                }
            }
        }
        console.log('✅ 所有数据导入完成！');
    } catch (err) {
        console.error('导入出错:', err);
    } finally {
        conn.release();
        process.exit();
    }
}

importData();