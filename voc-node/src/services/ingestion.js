// src/services/ingestion.js
import prisma from '../lib/prisma.js';

/**
 * 核心：通用入库函数
 * 自动处理 App 注册和反馈去重
 */
async function ingestFeedbackBatch(normalizedItems) {
  let created = 0;
  let updated = 0;

  for (const item of normalizedItems) {
    // 1. 确保 AppConfig 存在
    await prisma.appConfig.upsert({
      where: { appId: item.appId },
      update: {},
      create: {
        appId: item.appId,
        appName: item.metaData?.appName || 'Unknown App',
        country: item.country || 'Unknown'
      }
    });

    // 2. 存入 Feedback
    const result = await prisma.feedback.upsert({
      where: {
        source_externalId: {
          source: item.source,
          externalId: item.externalId
        }
      },
      update: {
        metaData: item.metaData // 仅更新元数据
      },
      create: {
        appId: item.appId,
        source: item.source,
        externalId: item.externalId,
        originalTime: item.originalTime,
        content: item.content,
        metaData: item.metaData,
        status: 'PENDING' // 初始状态，等待 AI 分析
      }
    });

    // 简单判断是新增还是更新
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }
  
  return { created, updated };
}

/**
 * 适配器: Google Play JSON 清洗
 */
export async function processGooglePlayImport(rawJsonList, defaultCountry) {
  const normalized = rawJsonList.map(item => ({
    appId: item.appId || 'unknown.pkg',
    source: 'GOOGLE_PLAY',
    externalId: item.id,
    originalTime: new Date(item.date),
    content: item.text,
    country: item.country || defaultCountry,
    metaData: {
      appName: item.appName,
      score: item.score,
      version: item.version,
      thumbsUp: item.thumbsUp,
      replyText: item.replyText,
      replyDate: item.replyDate
    }
  }));

  return await ingestFeedbackBatch(normalized);
}