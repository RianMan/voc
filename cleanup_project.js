import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义需要删除的文件和文件夹列表 (相对于项目根目录)
const pathsToDelete = [
    // === 后端清理 (voc-mysql) ===
    'voc-mysql/src/analyze.js',
    'voc-mysql/src/analyzeGroups.js',
    // 删除旧的 DB 操作 (只保留 connection.js, users.js, index.js 需重写)
    'voc-mysql/src/db/feedbacks.js',
    'voc-mysql/src/db/status.js', 
    'voc-mysql/src/db/reports.js',
    'voc-mysql/src/db/costs.js',
    'voc-mysql/src/db/utils.js',
    // 删除旧的路由
    'voc-mysql/src/routes/voc.js',
    'voc-mysql/src/routes/status.js',
    'voc-mysql/src/routes/report.js',
    'voc-mysql/src/routes/advancedRoutes.js',
    'voc-mysql/src/routes/groupRoutes.js',
    'voc-mysql/src/routes/weeklyReport.js',
    // 删除旧的服务
    'voc-mysql/src/services/ClusterService.js',
    'voc-mysql/src/services/ReportService.js',
    'voc-mysql/src/services/TopicService.js',
    'voc-mysql/src/services/VerificationService.js',
    'voc-mysql/src/services/WeeklyReportService.js',
    'voc-mysql/src/services/dataLoader.js',
    // 删除脚本
    'voc-mysql/scripts/seed.js',
    'voc-mysql/scripts/import_json_to_mysql.js',
    'voc-mysql/scripts/migrate-sqlite-to-mysql.js',

    // === 前端清理 (src) ===
    // 删除旧页面
    'pages/Dashboard.tsx',
    'pages/Reports.tsx',
    'pages/ReportArchive.tsx',
    'pages/CostOverview.tsx',
    'pages/TopicManager.tsx',
    'pages/ClusterAnalysis.tsx',
    'pages/VerificationTracker.tsx',
    'pages/IssueHandler.tsx',
    'pages/Help.tsx',
    // UserManagement 如果你想保留可以注释掉下面这行，但为了纯净建议先删，后面重写简单的
    'pages/UserManagement.tsx', 
    
    // 删除旧组件
    'components/NoteModal.tsx',
    'components/RiskBadge.tsx',
    'components/StatusBadge.tsx',
    'components/VerificationHistoryDrawer.tsx',
    
    // 删除旧 Service 模块
    'services/modules/voc.ts',
    'services/modules/stats.ts',
    'services/modules/notes.ts',
    'services/modules/reports.ts',
    'services/modules/topics.ts',
    'services/modules/clusters.ts',
    'services/modules/verifications.ts',
    'services/modules/groups.ts'
];

// 执行删除
console.log('🗑️  开始清理旧文件...');

pathsToDelete.forEach(relativePath => {
    const fullPath = path.join(__dirname, relativePath);
    
    if (fs.existsSync(fullPath)) {
        try {
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
                console.log(`✅ 删除目录: ${relativePath}`);
            } else {
                fs.unlinkSync(fullPath);
                console.log(`✅ 删除文件: ${relativePath}`);
            }
        } catch (e) {
            console.error(`❌ 删除失败: ${relativePath}`, e.message);
        }
    } else {
        // console.log(`⏭️  跳过 (不存在): ${relativePath}`);
    }
});

console.log('\n✨ 项目清理完成！现在的环境非常干净。');
console.log('👉 接下来请运行新的 SQL 并创建新的后端逻辑。');