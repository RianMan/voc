import { Router } from 'express';
import vocRoutes from './voc.js';
import statusRoutes from './status.js';
import reportRoutes from './report.js';
import authRoutes from './auth.js';
import advancedRoutes from './advancedRoutes.js';
import groupRoutes from './groupRoutes.js';

const router = Router();

// 挂载所有路由
router.use(authRoutes);
router.use(vocRoutes);
router.use(statusRoutes);
router.use(reportRoutes);
router.use(groupRoutes);  // 高级功能路由
router.use(advancedRoutes);  // 高级功能路由

export default router;
