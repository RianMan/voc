import { Router } from 'express';
import vocRoutes from './voc.js';
import statusRoutes from './status.js';
import reportRoutes from './report.js';
import authRoutes from './auth.js';

const router = Router();

// 挂载所有路由
router.use(authRoutes);
router.use(vocRoutes);
router.use(statusRoutes);
router.use(reportRoutes);

export default router;
