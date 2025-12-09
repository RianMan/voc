import { Router } from 'express';
import { loadDataWithStatus, filterData, paginate } from '../services/dataLoader.js';

const router = Router();

/**
 * GET /api/voc-data
 * 获取VOC数据列表（支持筛选和分页）
 */
router.get('/voc-data', (req, res) => {
    try {
        const { page = 1, limit = 10, ...filters } = req.query;
        
        // 加载数据（含状态）
        let data = loadDataWithStatus();
        
        // 应用筛选
        data = filterData(data, filters);
        
        // 分页
        const result = paginate(data, page, limit);
        
        res.json(result);
    } catch (e) {
        console.error('[VOC] Get data failed:', e);
        res.status(500).json({ error: 'Get data failed' });
    }
});

export default router;
