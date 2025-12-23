import { Router } from 'express';
import { loadDataWithStatus, filterData, paginate } from '../services/dataLoader.js';
import { getNotes, addNote, getStatusHistory, getCostStats, getVocStats, getVocTrend  } from '../db/index.js';

const router = Router();

/**
 * GET /api/voc/stats
 * 获取统计数据（不分页）
 */
router.get('/stats', async (req, res) => {
    try {
        const { appId } = req.query;
        const stats = await getVocStats(appId);
        res.json({ success: true, data: stats });
    } catch (e) {
        console.error('[VOC Stats] Failed:', e);
        res.status(500).json({ error: 'Get stats failed' });
    }
});

/**
 * GET /api/voc/trend
 * 获取周趋势数据
 */
router.get('/trend', async (req, res) => {
    try {
        const { appId, weeks = 8 } = req.query;
        const trend = await getVocTrend(appId, weeks);
        res.json({ success: true, data: trend });
    } catch (e) {
        console.error('[VOC Trend] Failed:', e);
        res.status(500).json({ error: 'Get trend failed' });
    }
});

/**
 * GET /api/voc/voc-data
 * 获取VOC数据列表（支持筛选和分页）
 */
router.get('/voc-data', async (req, res) => {
    try {
        const { page = 1, limit = 10, ...filters } = req.query;
        // 直接调用 filterData，传入筛选条件和分页参数
        const result = await filterData(filters, page, limit);
        res.json(result);
    } catch (e) {
        console.error('[VOC] Get data failed:', e);
        res.status(500).json({ error: 'Get data failed' });
    }
});
// ==================== 备注与历史相关接口 ====================

/**
 * GET /api/voc/:id/notes
 * 获取指定评论的备注列表
 */
router.get('/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const notes = await getNotes(id);
        res.json({ success: true, data: notes });
    } catch (e) {
        console.error('[VOC] Get notes failed:', e);
        res.status(500).json({ error: 'Get notes failed' });
    }
});

/**
 * POST /api/voc/:id/notes
 * 添加备注
 */
router.post('/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user?.id || 0;
        const userName = req.user?.username || req.user?.display_name || 'Operator';

        const result = await addNote(id, userId, userName, content);
        res.json({ success: true, id: result.id });
    } catch (e) {
        console.error('[VOC] Add note failed:', e);
        res.status(500).json({ error: 'Add note failed' });
    }
});

/**
 * GET /api/voc/:id/history
 * 获取状态变更历史
 */
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        const history = await getStatusHistory(id);
        res.json({ success: true, data: history });
    } catch (e) {
        console.error('[VOC] Get history failed:', e);
        res.status(500).json({ error: 'Get history failed' });
    }
});

/**
 * GET /api/voc/costs
 * 获取 AI 费用统计
 */
router.get('/costs', async (req, res) => {
    try {
        const stats = await getCostStats();
        console.log(stats, 'stats');
        res.json({ success: true, data: stats });
    } catch (e) {
        console.error('[VOC] Get cost stats failed:', e);
        res.status(500).json({ error: 'Get cost stats failed' });
    }
});

export default router;
