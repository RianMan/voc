import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processGooglePlayImport } from '../src/services/ingestion.js';
import prisma from '../src/lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');

// 递归查找 JSON 文件
function scanRawFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(scanRawFiles(fullPath));
        } else if (entry.isFile() && entry.name.startsWith('raw_reviews_') && entry.name.endsWith('.json')) {
            results.push(fullPath);
        }
    }
    return results;
}

async function main() {
    console.log('🚀 开始导入 Google Play 历史数据...');
    const files = scanRawFiles(DATA_DIR);
    
    if (files.length === 0) {
        console.log('❌ 未找到数据文件，请检查 voc-node/data 目录');
        return;
    }

    for (const file of files) {
        const relativePath = path.relative(DATA_DIR, file);
        process.stdout.write(`   处理文件: ${relativePath} ... `);
        
        try {
            const content = fs.readFileSync(file, 'utf8');
            const rawData = JSON.parse(content);
            
            // 简单的国家代码推断 (例如路径包含 /mx/ )
            const pathParts = relativePath.split(path.sep);
            const countryCode = pathParts.length > 1 ? pathParts[0].toUpperCase() : 'UNKNOWN';

            const result = await processGooglePlayImport(rawData, countryCode);
            console.log(`✅ 新增: ${result.created}, 更新: ${result.updated}`);
        } catch (e) {
            console.log(`❌ 失败: ${e.message}`);
        }
    }
    
    console.log('\n🎉 导入完成！');
    await prisma.$disconnect();
}

main();