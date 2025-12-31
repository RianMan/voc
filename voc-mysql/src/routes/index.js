import { Router } from 'express';
import authRoutes from './auth.js';
import vocRoutes from './voc.js';       // 包含概览、趋势、统计
import insightsRoutes from './insights.js'; // 新业务：反馈提炼
import tasksRoutes from './tasks.js';       // 新业务：事项跟进
import topicsRoutes from './topics.js';     // 新业务：专题配置
import adminRoutes from './admin.js';
import apps from './apps.js';

const router = Router();

// 1. 认证路由
router.use(authRoutes);

// 2. VOC 核心数据路由 (挂载在 /voc 下)
// 这样前端请求 /api/voc/trend-analysis 才能正确匹配到 voc.js 里的 /trend-analysis
router.use('/voc', vocRoutes);

// 3. 洞察提炼路由
router.use('/insights', insightsRoutes);

// 4. 事项转化路由
router.use('/tasks', tasksRoutes);

// 5. 专题管理路由
router.use('/topics', topicsRoutes);

router.use('/admin', adminRoutes);

router.use('/apps', apps);


export default router;