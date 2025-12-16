import { Router } from 'express';
import { 
    updateStatus, 
    getStatusHistory, 
    getStatusStats,
    addNote,
    getNotes,
    getNotesCount,
    STATUS,
    STATUS_LABELS 
} from '../db.js';
import { authMiddleware, requireRole, optionalAuth } from '../middleware/auth.js';

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
 * 更新单条记录状态（需要登录）
 */
router.put('/voc/:id/status', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;
        
        if (!status || !Object.values(STATUS).includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const result = await updateStatus(id, status, req.user, note);
        res.json({ success: true, ...result });
    } catch (e) {
        console.error('[Status] Update failed:', e);
        res.status(500).json({ error: 'Update failed' });
    }
});

/**
 * PUT /api/voc/batch-status
 * 批量更新状态（需要登录）
 */
router.put('/voc/batch-status', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
    try {
        const { ids, status, note } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Please provide ID list' });
        }
        
        if (!status || !Object.values(STATUS).includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const results = await Promise.all(
            ids.map(id => updateStatus(id, status, req.user, note))
        );
        
        res.json({ 
            success: true, 
            updated: results.length,
            updatedBy: req.user.display_name || req.user.username
        });
    } catch (e) {
        console.error('[Status] Batch update failed:', e);
        res.status(500).json({ error: 'Batch update failed' });
    }
});

/**
 * GET /api/voc/:id/history
 * 获取状态变更历史
 */
router.get('/voc/:id/history', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const history = await getStatusHistory(id);
        res.json({ success: true, data: history });
    } catch (e) {
        res.status(500).json({ error: 'Get history failed' });
    }
});

/**
 * GET /api/stats/status
 * 获取状态统计
 */
router.get('/stats/status', async (req, res) => {
    try {
        const stats = await getStatusStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: 'Get stats failed' });
    }
});

// ==================== 备注功能 ====================

/**
 * GET /api/voc/:id/notes
 * 获取问题备注列表
 */
router.get('/voc/:id/notes', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const notes = await getNotes(id);
        res.json({ success: true, data: notes });
    } catch (e) {
        res.status(500).json({ error: 'Get notes failed' });
    }
});

/**
 * POST /api/voc/:id/notes
 * 添加问题备注（需要登录）
 */
router.post('/voc/:id/notes', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: '备注内容不能为空' });
        }
        
        const userName = req.user.display_name || req.user.username;
        const result = await addNote(id, req.user.id, userName, content.trim());
        
        res.json({ 
            success: true, 
            id: result.id,
            userName
        });
    } catch (e) {
        console.error('[Notes] Add failed:', e);
        res.status(500).json({ error: 'Add note failed' });
    }
});

/**
 * POST /api/voc/notes-count
 * 批量获取备注数量
 */
router.post('/voc/notes-count', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: 'Please provide ID list' });
        }
        
        const counts = await getNotesCount(ids);
        res.json({ success: true, data: counts });
    } catch (e) {
        res.status(500).json({ error: 'Get notes count failed' });
    }
});

export default router;
