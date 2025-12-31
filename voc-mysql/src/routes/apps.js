// 文件路径：voc-mysql/src/routes/apps.js
import { Router } from 'express';
import { getAllApps, upsertAppConfig, deleteApp } from '../db/apps.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware, requireRole('admin')); // 仅管理员可操作

// 获取列表
router.get('/', async (req, res) => {
  try {
    const apps = await getAllApps();
    res.json({ success: true, data: apps });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 新增/编辑 (接收完整配置)
router.post('/', async (req, res) => {
  try {
    const { appId, appName, country, views, udeskConfig } = req.body;
    await upsertAppConfig(appId, appName, country, views, udeskConfig);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 删除
router.delete('/:id', async (req, res) => {
  try {
    await deleteApp(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;