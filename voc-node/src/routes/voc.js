import express from 'express';
import prisma from '../lib/prisma.js'; // 导入新数据库客户端
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 获取 VOC 列表 (支持分页、筛选、搜索)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { category, risk, country, search, startDate, endDate, status, appId } = req.query;

    // 1. 构建过滤条件
    const where = {};

    // App/国家 筛选
    if (appId && appId !== 'All') where.appId = appId;
    if (country && country !== 'All') where.app = { country: country }; // 关联查询

    // 状态筛选
    if (status && status !== 'All') where.status = status;

    // 类别/风险筛选
    if (category && category !== 'All') where.category = category;
    if (risk && risk !== 'All') where.riskLevel = risk; // 注意数据库字段是 camelCase

    // 日期范围
    if (startDate || endDate) {
      where.originalTime = {};
      if (startDate) where.originalTime.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.originalTime.lte = end;
      }
    }

    // 关键词搜索 (匹配原文、翻译、摘要)
    if (search) {
      where.OR = [
        { content: { contains: search } },
        { translatedText: { contains: search } },
        { summary: { contains: search } }
      ];
    }

    // 2. 查询数据库
    const [total, items] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where,
        orderBy: { originalTime: 'desc' }, // 按时间倒序
        skip,
        take: limit,
        include: {
          app: true, // 关联获取 appName
          notes: true // 获取备注数量
        }
      })
    ]);

    // 3. 格式化数据 (适配前端字段)
    const formattedData = items.map(item => ({
      id: item.id,
      date: item.originalTime,
      country: item.app?.country || 'Unknown',
      source: item.source,
      appId: item.appId,
      appName: item.app?.appName || item.metaData?.appName,
      
      // 核心内容
      text: item.content,
      translated_text: item.translatedText, // 转回下划线
      summary: item.summary,
      
      // AI 分析
      category: item.category || 'Other',
      risk_level: item.riskLevel || 'Low', // 转回下划线
      score: item.metaData?.score || 0,
      
      // 深度洞察 (新字段)
      root_cause: item.rootCause,
      action_advice: item.actionAdvice,
      suggested_reply: item.suggestedReply,

      // 状态
      status: item.status,
      statusNote: item.statusNote,
      notesCount: item.notes.length
    }));

    res.json({
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[API] 获取列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取统计信息 (Dashboard 图表)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // 简单统计：按风险等级
    const riskStats = await prisma.feedback.groupBy({
      by: ['riskLevel'],
      _count: { id: true }
    });

    // 按类别
    const catStats = await prisma.feedback.groupBy({
      by: ['category'],
      _count: { id: true }
    });

    res.json({
      riskDistribution: riskStats.map(s => ({ name: s.riskLevel, value: s._count.id })),
      categoryDistribution: catStats.map(s => ({ name: s.category, value: s._count.id }))
    });
  } catch (error) {
    res.status(500).json({ error: '统计获取失败' });
  }
});

export default router;