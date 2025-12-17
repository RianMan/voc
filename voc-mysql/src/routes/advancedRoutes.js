/**
 * advancedRoutes.js
 * 高级功能 API 路由
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';

// Services
import TopicService from '../services/TopicService.js';
import ClusterService from '../services/ClusterService.js';
import VerificationService from '../services/VerificationService.js';
import WeeklyReportService from '../services/WeeklyReportService.js';
import { loadDataWithStatus } from '../services/dataLoader.js';

const router = Router();

// ==================== 专题配置 API ====================

/**
 * GET /api/topics
 * 获取专题列表
 */
router.get('/topics', async (req, res) => {
  try {
    const { scope, country, appId, isActive } = req.query;
    const topics = await TopicService.getTopics({ 
      scope, country, appId, 
      isActive: isActive !== undefined ? isActive === 'true' : undefined 
    });
    res.json({ success: true, data: topics });
  } catch (e) {
    console.error('[Topics] Get failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/topics
 * 创建专题
 */
router.post('/topics', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const result = await TopicService.createTopic({
      ...req.body,
      createdBy: req.user?.id
    });
    res.json(result);
  } catch (e) {
    console.error('[Topics] Create failed:', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * PUT /api/topics/:id
 * 更新专题
 */
router.put('/topics/:id', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const result = await TopicService.updateTopic(req.params.id, req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/topics/:id
 * 删除专题
 */
router.delete('/topics/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await TopicService.deleteTopic(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/topics/scan
 * 执行专题扫描（扫描所有评论匹配专题）
 */
router.post('/topics/scan', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { appId, limit = 500 } = req.body;
    
    const response = await loadDataWithStatus();
    
    // 2. 提取数据数组 [修改点]
    let reviews = response.data || [];
    if (appId) {
      reviews = reviews.filter(r => r.appId === appId);
    }
    reviews = reviews.slice(0, parseInt(limit));
    
    const result = await TopicService.batchScanReviews(reviews);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[Topics] Scan failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/topics/:id/analyze
 * AI 分析专题
 */
router.post('/topics/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const reviews = await TopicService.getTopicMatchedReviews(topicId, req.body);
    console.log(reviews, typeof reviews);
    if (reviews.length === 0) {
      return res.json({ success: true, message: '无匹配评论' });
    }
    
    const result = await TopicService.analyzeTopicWithAI(topicId, reviews);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[Topics] Analyze failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/topics/:id/history
 * 获取专题分析历史
 */
router.get('/topics/:id/history', async (req, res) => {
  try {
    const history = await TopicService.getTopicAnalysisHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 聚类 API ====================

/**
 * GET /api/clusters
 * 获取聚类结果
 */
router.get('/clusters', async (req, res) => {
  try {
    const { appId, category, weekNumber, year } = req.query;
    const clusters = await ClusterService.getClusters({ 
      appId, category, 
      weekNumber: weekNumber ? parseInt(weekNumber) : undefined,
      year: year ? parseInt(year) : undefined
    });
    res.json({ success: true, data: clusters });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/clusters/run
 * 执行聚类分析
 */
router.post('/clusters/run', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { appId, category, startDate, endDate } = req.body;
    if (!appId || !category) return res.status(400).json({ error: 'appId 和 category 必填' });

    const result = await ClusterService.runClusteringForApp(appId, category, { startDate, endDate });
    res.json(result);
  } catch (e) {
    console.error('[Clusters] Run failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/clusters/run-weekly
 * 执行本周全量聚类
 */
router.post('/clusters/run-weekly', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await ClusterService.runWeeklyClustering();
    res.json(result);
  } catch (e) {
    console.error('[Clusters] Weekly run failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/clusters/summary/:appId
 * 获取某 App 最新聚类摘要
 */
router.get('/clusters/summary/:appId', async (req, res) => {
  try {
    const summary = await ClusterService.getLatestClusterSummary(req.params.appId);
    res.json({ success: true, data: summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 闭环验证 API ====================

/**
 * GET /api/verifications
 * 获取验证配置列表
 */
router.get('/verifications', async (req, res) => {
  try {
    const { appId, status } = req.query;
    const configs = await VerificationService.getVerificationConfigs({ appId, status });
    res.json({ success: true, data: configs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/verifications
 * 创建验证配置
 */
router.post('/verifications', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const result = await VerificationService.createVerificationConfig({
      ...req.body,
      createdBy: req.user?.id
    });
    res.json(result);
  } catch (e) {
    console.error('[Verifications] Create failed:', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /api/verifications/quick
 * 快速创建验证（自动计算基准期）
 */
router.post('/verifications/quick', authMiddleware, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const result = await VerificationService.quickCreateVerification({
      ...req.body,
      createdBy: req.user?.id
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /api/verifications/:id/run
 * 执行单个验证
 */
router.post('/verifications/:id/run', authMiddleware, async (req, res) => {
  try {
    const result = await VerificationService.runVerification(parseInt(req.params.id));
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[Verifications] Run failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/verifications/run-all
 * 执行所有监控中的验证
 */
router.post('/verifications/run-all', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await VerificationService.runAllVerifications();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/verifications/:id/history
 * 获取验证历史
 */
router.get('/verifications/:id/history', async (req, res) => {
  try {
    const history = await VerificationService.getVerificationHistory(parseInt(req.params.id));
    res.json({ success: true, data: history });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/verifications/summary/:appId
 * 获取某 App 的验证摘要
 */
router.get('/verifications/summary/:appId', async (req, res) => {
  try {
    const summary = await VerificationService.getVerificationSummary(req.params.appId);
    res.json({ success: true, data: summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 周报 API ====================

/**
 * POST /api/weekly-report/generate/:appId
 * 生成某 App 的周报
 */
router.post('/weekly-report/generate/:appId', authMiddleware, async (req, res) => {
  try {
    const result = await WeeklyReportService.generateAIWeeklyReport(
      req.params.appId, 
      req.user
    );
    res.json(result);
  } catch (e) {
    console.error('[WeeklyReport] Generate failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/weekly-report/generate-all
 * 批量生成所有 App 周报
 */
router.post('/weekly-report/generate-all', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await WeeklyReportService.generateAllWeeklyReports(req.user);
    res.json(result);
  } catch (e) {
    console.error('[WeeklyReport] Generate all failed:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/weekly-report/structured/:appId
 * 获取结构化周报数据（JSON）
 */
router.get('/weekly-report/structured/:appId', async (req, res) => {
  try {
    const data = await WeeklyReportService.generateStructuredReport(req.params.appId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
