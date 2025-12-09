import { Router } from 'express';
import { generateReport } from '../services/reportGen.js';
import { generateReportWithQW } from '../services/reportGenQW.js';

const router = Router();

/**
 * POST /api/report/generate
 * 生成 AI 分析报告 (DeepSeek)
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
 * POST /api/report/generate-claude
 * 生成 AI 分析报告 (Claude)
 */
router.post('/report/generate-qw', async (req, res) => {
    try {
        const { filters = {}, limit = 100 } = req.body;
        
        const result = await generateReportWithQW(filters, limit);
        
        res.json(result);
    } catch (e) {
        console.error('[Report-Claude] Generation failed:', e);
        res.status(500).json({ 
            error: 'Report generation failed', 
            message: e.message 
        });
    }
});

export default router;
