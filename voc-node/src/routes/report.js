import { Router } from 'express';
import { generateReport } from '../services/reportGen.js';
import { generateReportWithQW } from '../services/reportGenQW.js';
import { 
  generateReportForApp, 
  generateAllAppReports,
  groupDataByApp 
} from '../services/reportGenV2.js';
import { loadAllReports } from '../services/dataLoader.js';
import { 
  getAllReports, 
  getReportsByApp, 
  getReportById,
  getAllApps,
  upsertAppConfig
} from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/report/generate
 * 生成 AI 分析报告 (DeepSeek) - 旧版兼容
 */
router.post('/report/generate', async (req, res) => {
  try {
    const { filters = {}, limit = 100 } = req.body;
    const result = await generateReport(filters, limit);
    res.json(result);
  } catch (e) {
    console.error('[Report] Generation failed:', e);
    res.status(500).json({ 
      error: 'Report generation failed', 
      message: e.message 
    });
  }
});

/**
 * POST /api/report/generate-qw
 * 生成 AI 分析报告 (通义千问) - 旧版兼容
 */
router.post('/report/generate-qw', async (req, res) => {
  try {
    const { filters = {}, limit = 100 } = req.body;
    const result = await generateReportWithQW(filters, limit);
    res.json(result);
  } catch (e) {
    console.error('[Report-QW] Generation failed:', e);
    res.status(500).json({ 
      error: 'Report generation failed', 
      message: e.message 
    });
  }
});

/**
 * POST /api/report/generate-app
 * 【新】为指定App生成周报
 */
router.post('/report/generate-app', authMiddleware, async (req, res) => {
  try {
    const { appId, filters = {}, limit = 200 } = req.body;
    
    if (!appId) {
      return res.status(400).json({ error: 'appId is required' });
    }
    
    const result = await generateReportForApp(appId, filters, limit, req.user); 
    res.json(result);
  } catch (e) {
    console.error('[Report-App] Generation failed:', e);
    res.status(500).json({ 
      error: 'Report generation failed', 
      message: e.message 
    });
  }
});

/**
 * POST /api/report/generate-all
 * 【新】为所有App批量生成周报
 */
router.post('/report/generate-all', async (req, res) => {
  try {
    const results = await generateAllAppReports();
    res.json({
      success: true,
      generated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (e) {
    console.error('[Report-All] Generation failed:', e);
    res.status(500).json({ 
      error: 'Batch generation failed', 
      message: e.message 
    });
  }
});

/**
 * GET /api/reports
 * 【新】获取报告存档列表
 */
router.get('/reports', (req, res) => {
  try {
    const { appId, limit = 50 } = req.query;
    
    let reports;
    if (appId) {
      reports = getReportsByApp(appId, parseInt(limit));
    } else {
      reports = getAllReports(parseInt(limit));
    }
    
    res.json({ success: true, data: reports });
  } catch (e) {
    console.error('[Reports] Get failed:', e);
    res.status(500).json({ error: 'Get reports failed' });
  }
});

/**
 * GET /api/reports/:id
 * 【新】获取单个报告详情
 */
router.get('/reports/:id', (req, res) => {
  try {
    const { id } = req.params;
    const report = getReportById(parseInt(id));
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json({ success: true, data: report });
  } catch (e) {
    console.error('[Reports] Get detail failed:', e);
    res.status(500).json({ error: 'Get report failed' });
  }
});

/**
 * GET /api/apps
 * 【新】获取所有App列表
 */
router.get('/apps', (req, res) => {
  try {
    // 先从数据中获取所有App
    const data = loadAllReports();
    const groups = groupDataByApp(data);
    
    const apps = Object.values(groups).map(g => ({
      appId: g.appId,
      appName: g.appName,
      country: g.country,
      totalReviews: g.items.length
    }));
    
    // 同步到数据库
    apps.forEach(app => {
      upsertAppConfig(app.appId, app.appName, app.country);
    });
    
    res.json({ success: true, data: apps });
  } catch (e) {
    console.error('[Apps] Get failed:', e);
    res.status(500).json({ error: 'Get apps failed' });
  }
});

export default router;
