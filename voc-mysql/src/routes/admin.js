import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { runAnalysis } from '../analyze.js';
import { runFetchGooglePlay } from '../fetch.js';
import { runFetchUdesk } from '../fetchUdesk.js';
import { getAllApps } from '../db/apps.js'; // ✅ 引入这个，用于查找App配置

const router = Router();
router.use(authMiddleware, requireRole('admin'));

// 1. 触发 AI 分析
router.post('/trigger/analyze', async (req, res) => {
  // ✅ 接收 targetAppId
  const { targetAppId } = req.body; 
  try {
    const result = await runAnalysis(targetAppId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. 触发 GP 抓取
router.post('/trigger/fetch-gp', async (req, res) => {
  const { days = 7, targetAppId } = req.body; // ✅ 接收 targetAppId
  try {
    let appConfig = null;
    // 如果指定了 App，先查出它的配置对象
    if (targetAppId) {
        const apps = await getAllApps();
        const app = apps.find(a => a.app_id === targetAppId);
        if (app) {
            // 构造 fetch.js 需要的 config 格式
            appConfig = {
                appId: app.app_id,
                appName: app.app_name,
                views: app.views && app.views.length > 0 ? app.views : [
                    { country: app.country.toLowerCase(), lang: 'es', label: `${app.country}_es` }
                ]
            };
        }
    }
    const result = await runFetchGooglePlay(Number(days), appConfig);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. 触发 Udesk 抓取
router.post('/trigger/fetch-udesk', async (req, res) => {
  const { days = 7, targetAppId } = req.body; // ✅ 接收 targetAppId
  try {
    let appConfig = null;
    if (targetAppId) {
        const apps = await getAllApps();
        const app = apps.find(a => a.app_id === targetAppId);
        if (app) appConfig = app; // fetchUdesk 直接用 DB 对象即可
    }
    const result = await runFetchUdesk(Number(days), appConfig);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;