import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generateWeeklyReport } from '../services/WeeklyReportService.js';

const router = Router();

/**
 * POST /api/weekly-report/generate
 * 生成周报
 */
router.post('/weekly-report/generate', authMiddleware, async (req, res) => {
  try {
    const { appId, weekOffset = 0 } = req.body;
    
    if (!appId) {
      return res.status(400).json({ error: 'appId is required' });
    }
    
    const result = await generateWeeklyReport(appId, { weekOffset }, req.user);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (e) {
    console.error('[WeeklyReport] Generation failed:', e);
    res.status(500).json({ 
      error: 'Report generation failed', 
      message: e.message 
    });
  }
});

export default router;