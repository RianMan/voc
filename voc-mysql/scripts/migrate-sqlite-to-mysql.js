/**
 * SQLite -> MySQL 数据迁移脚本
 * 
 * 使用方法:
 * 1. 确保 MySQL 数据库已创建（运行 init.sql）
 * 2. 配置 .env 中的 MySQL 连接信息
 * 3. 运行: node scripts/migrate-sqlite-to-mysql.js
 */

import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_PATH = path.join(__dirname, '../data/voc.db');

async function migrate() {
  console.log('🚀 开始迁移 SQLite -> MySQL...\n');

  // 连接 SQLite
  let sqlite;
  try {
    sqlite = new Database(SQLITE_PATH, { readonly: true });
    console.log('✅ SQLite 连接成功');
  } catch (e) {
    console.error('❌ SQLite 连接失败:', e.message);
    console.log('   如果是新部署，可以跳过迁移直接使用 MySQL');
    return;
  }

  // 连接 MySQL
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'voc_db',
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL 连接成功\n');
    conn.release();
  } catch (e) {
    console.error('❌ MySQL 连接失败:', e.message);
    return;
  }

  // 迁移表
  const tables = [
    { name: 'users', idField: 'id' },
    { name: 'review_status', idField: 'review_id' },
    { name: 'status_logs', idField: 'id' },
    { name: 'review_notes', idField: 'id' },
    { name: 'reports', idField: 'id' },
    { name: 'email_subscriptions', idField: 'id' },
    { name: 'app_configs', idField: 'app_id' },
    { name: 'ai_costs', idField: 'id' }
  ];

  for (const table of tables) {
    await migrateTable(sqlite, pool, table.name);
  }

  console.log('\n✨ 迁移完成！');
  
  sqlite.close();
  await pool.end();
}

async function migrateTable(sqlite, pool, tableName) {
  process.stdout.write(`📦 迁移 ${tableName}...`);

  try {
    // 检查 SQLite 表是否存在
    const tableExists = sqlite.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName);

    if (!tableExists) {
      console.log(' ⏭️  表不存在，跳过');
      return;
    }

    // 读取 SQLite 数据
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    
    if (rows.length === 0) {
      console.log(' ⏭️  无数据');
      return;
    }

    // 获取列名
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    
    // 批量插入 MySQL
    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      // 先清空目标表（可选，如果需要增量迁移请注释掉）
      await conn.execute(`DELETE FROM ${tableName}`);
      
      let inserted = 0;
      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          // 处理布尔值
          if (val === true) return 1;
          if (val === false) return 0;
          return val;
        });
        
        try {
          await conn.execute(
            `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        } catch (e) {
          // 忽略重复键错误
          if (e.code !== 'ER_DUP_ENTRY') {
            console.error(`\n   ⚠️  插入失败: ${e.message}`);
          }
        }
      }
      
      await conn.commit();
      console.log(` ✅ ${inserted}/${rows.length} 条`);
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.log(` ❌ 失败: ${e.message}`);
  }
}

migrate().catch(console.error);
