import { runBatchAnalysis } from '../src/services/analysis.js';
import prisma from '../src/lib/prisma.js';

const BATCH_SIZE = 10;
const INTERVAL_MS = 2000; // 2秒间隔

async function loop() {
    console.log('🤖 AI 分析服务启动 (Model: Qwen-Plus)...');
    console.log('   按 Ctrl+C 停止');

    let isRunning = true;
    process.on('SIGINT', () => { isRunning = false; console.log('\nStopping...'); });

    while (isRunning) {
        try {
            const count = await prisma.feedback.count({
                where: { category: null }
            });

            if (count === 0) {
                process.stdout.write('.');
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }

            console.log(`\n📨 待处理: ${count} 条`);
            const result = await runBatchAnalysis(BATCH_SIZE);
            
            // 如果出错，暂停久一点
            const waitTime = (result.error) ? 10000 : INTERVAL_MS;
            await new Promise(r => setTimeout(r, waitTime));

        } catch (e) {
            console.error('Fatal:', e);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    await prisma.$disconnect();
    process.exit(0);
}

loop();