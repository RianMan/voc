import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// ================= 配置区域 =================
const DB_CONFIG = {
    host: 'localhost',      // 您的数据库地址
    user: 'root',           // 您的数据库用户名
    password: '',   // 您的数据库密码
    database: 'voc_db'      // 您的数据库名
};

const TARGET_APP_ID = 'com.pinjamwinwin';
const TARGET_APP_NAME = 'Pinjamin';
const KEYWORD = '催款'; 

// ===========================================

async function seedData() {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✅ 数据库连接成功');

        // ---------------------------------------------------------
        // 🔥 修复点：先检查并创建表，防止报错
        // ---------------------------------------------------------
        console.log('🔨 正在检查表结构...');
        
        // 1. 创建 reviews 表
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS reviews (
                id VARCHAR(36) PRIMARY KEY,
                app_id VARCHAR(255),
                app_name VARCHAR(255),
                text TEXT,
                translated_text TEXT,
                created_at DATETIME,
                date DATE,
                country VARCHAR(50),
                score INT
            )
        `);

        // 2. 创建 verification_configs 表 (如果也不存在的话)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS verification_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                app_id VARCHAR(255),
                issue_type VARCHAR(50),
                issue_value VARCHAR(255),
                baseline_start DATE,
                baseline_end DATE,
                verify_start DATE,
                verify_end DATE,
                optimization_desc TEXT,
                status VARCHAR(50) DEFAULT 'monitoring',
                created_by INT,
                expected_reduction DECIMAL(5,2),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ 表结构检查完毕');

        // ---------------------------------------------------------

        // 1. 清理旧数据
        console.log('🧹 正在清理旧的测试数据...');
        await connection.execute(`DELETE FROM reviews WHERE app_id = ?`, [TARGET_APP_ID]);
        await connection.execute(`DELETE FROM verification_configs WHERE app_id = ? AND issue_value = ?`, [TARGET_APP_ID, KEYWORD]);

        // 2. 定义两个时间段
        const periods = [
            {
                name: '基准期 (表现差)',
                start: '2025-11-01',
                end: '2025-11-30',
                count: 50,           
                complainRate: 0.8    
            },
            {
                name: '验证期 (表现好)',
                start: '2025-12-01',
                end: '2025-12-17',
                count: 50,           
                complainRate: 0.1    
            }
        ];

        // 3. 循环插入评论数据
        const insertSql = `
            INSERT INTO reviews 
            (id, app_id, app_name, text, translated_text, created_at, date, country, score) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const period of periods) {
            console.log(`🚀 开始生成 [${period.name}] 数据...`);
            for (let i = 0; i < period.count; i++) {
                const isBadReview = Math.random() < period.complainRate;
                const randomTime = getRandomDate(period.start, period.end);
                const dateStr = randomTime.toISOString().split('T')[0];
                const datetimeStr = randomTime.toISOString().slice(0, 19).replace('T', ' ');

                let text, translatedText, score;

                if (isBadReview) {
                    text = "penagihan kasar sekali tolong";
                    translatedText = `你们的${KEYWORD}人员太恶心了，天天打电话，我要报警！`;
                    score = 1;
                } else {
                    text = "aplikasi bagus cepat cair";
                    translatedText = "非常好的应用，放款速度很快，利息也低。";
                    score = 5;
                }

                await connection.execute(insertSql, [
                    uuidv4(), TARGET_APP_ID, TARGET_APP_NAME, text, translatedText, datetimeStr, dateStr, 'ID', score
                ]);
            }
        }

        // 4. 创建验证规则
        console.log('⚙️ 正在创建验证规则...');
        const ruleSql = `
            INSERT INTO verification_configs 
            (app_id, issue_type, issue_value, baseline_start, baseline_end, verify_start, verify_end, optimization_desc, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await connection.execute(ruleSql, [
            TARGET_APP_ID, 'keyword', KEYWORD,
            '2025-11-01', '2025-11-30', '2025-12-01', null,
            '脚本自动创建的测试验证：优化了催收话术', 'monitoring', 1
        ]);

        console.log('\n🎉 脚本执行完毕！');

    } catch (err) {
        console.error('❌ 出错了:', err);
    } finally {
        if (connection) await connection.end();
    }
}

function getRandomDate(start, end) {
    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();
    return new Date(startDate + Math.random() * (endDate - startDate));
}

seedData();