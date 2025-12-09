import { Router } from 'express';
import { 
    updateStatus, 
    getStatusHistory, 
    getStatusStats,
    STATUS,
    STATUS_LABELS 
} from '../db.js';

const router = Router();

/**
 * GET /api/status-config
 * 获取状态配置（供前端使用）
 */
router.get('/status-config', (req, res) => {
    res.json({
        statuses: STATUS,
        labels: STATUS_LABELS
    });
});

/**
 * PUT /api/voc/:id/status
 * 更新单条记录状态
 */
router.put('/voc/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status, note, operator = 'user' } = req.body;
        
        if (!status || !Object.values(STATUS).includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const result = updateStatus(id, status, operator, note);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('[Status] Update failed:', e);
        res.status(500).json({ error: 'Update failed' });
    }
});

/**
 * PUT /api/voc/batch-status
 * 批量更新状态
 */
router.put('/voc/batch-status', (req, res) => {
    try {
        const { ids, status, note, operator = 'user' } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Please provide ID list' });
        }
        
        if (!status || !Object.values(STATUS).includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const results = ids.map(id => updateStatus(id, status, operator, note));
        res.json({ success: true, updated: results.length });
    } catch (e) {
        console.error('[Status] Batch update failed:', e);
        res.status(500).json({ error: 'Batch update failed' });
    }
});

/**
 * GET /api/voc/:id/history
 * 获取状态变更历史
 */
router.get('/voc/:id/history', (req, res) => {
    try {
        const { id } = req.params;
        const history = getStatusHistory(id);
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: 'Get history failed' });
    }
});

/**
 * GET /api/stats/status
 * 获取状态统计
 */
router.get('/stats/status', (req, res) => {
    try {
        const stats = getStatusStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: 'Get stats failed' });
    }
});

export default router;
