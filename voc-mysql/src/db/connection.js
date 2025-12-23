import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 数据库连接池 ====================
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'voc_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('[MySQL] 数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('[MySQL] 数据库连接失败:', err.message);
  });

export default pool;