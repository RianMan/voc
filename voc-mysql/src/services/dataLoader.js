import pool from '../db/index.js';

/**
 * 加载所有分析报告 (从 MySQL 读取)
 */
export async function loadAllReports() {
    return await filterData({}, 1, 1000);
}

/**
 * 加载数据并合并状态 (MySQL版)
 */
export async function loadDataWithStatus() {
    return await loadAllReports();
}

/**
 * 通用筛选与分页函数 (核心逻辑 - 修复版)
 */
export async function filterData(filters, page = 1, limit = 50) {
    const { category, risk, country, search, startDate, endDate, status, reportMode, appId, source } = filters;
    
    // 1. 构建基础查询部分 (FROM ... JOIN ... WHERE ...)
    // 这样可以同时用于 Count查询 和 Data查询，避免 indexOf 截取错误
    let baseSql = `
        FROM voc_feedbacks f
        LEFT JOIN voc_feedback_messages m ON f.id = m.feedback_id AND m.sequence_num = 1 AND m.role = 'user'
        WHERE f.process_status = 'analyzed' 
          AND f.app_id != 'Unknown' 
          AND f.app_name != 'Unknown'
    `;

    const params = [];

    // --- 动态添加条件 ---
    
    if (appId && appId !== 'All') {
        baseSql += ' AND f.app_id = ?';
        params.push(appId);
    }

    if (status && status !== 'All') {
        baseSql += ' AND f.status = ?';
        params.push(status);
    }

    if (category && category !== 'All') {
        baseSql += ' AND f.category = ?';
        params.push(category);
    }

    if (risk && risk !== 'All') {
        baseSql += ' AND f.risk_level = ?';
        params.push(risk);
    }

    if (country && country !== 'All') {
        baseSql += ' AND f.country = ?';
        params.push(country);
    }

    if (startDate) {
        baseSql += ' AND f.feedback_time >= ?';
        params.push(new Date(startDate));
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        baseSql += ' AND f.feedback_time <= ?';
        params.push(end);
    }

    // 报告模式：过滤掉 Low 和 Positive
    if (reportMode === 'true' || reportMode === true) {
        baseSql += " AND f.risk_level != 'Low' AND f.category != 'Positive'";
    }

    if (source && source !== 'All') {
        baseSql += ' AND f.source = ?';
        params.push(source);
    }

    // 搜索 (同时搜原文、翻译和摘要)
    if (search) {
        baseSql += ` AND (
            m.content LIKE ? OR 
            m.translated_content LIKE ? OR 
            f.summary LIKE ?
        )`;
        const term = `%${search}%`;
        params.push(term, term, term);
    }

    // 2. 执行 Count 查询 (只用基础部分)
    const countSql = `SELECT COUNT(*) as total ${baseSql}`;
    // 注意：params 此时只包含 WHERE 条件所需的参数
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0].total;

    // 3. 执行 Data 查询 (拼接完整的 SELECT 字段)
    let dataSql = `
        SELECT 
            f.id, f.source, f.external_id, f.source_url,
            f.app_id as appId, f.app_name as appName, f.country, f.version,
            f.user_name as userName, f.rating as score, f.feedback_time as date,
            f.category, f.risk_level, f.summary, f.root_cause, f.action_advice, f.suggested_reply,
            f.process_status, f.status, f.note as statusNote, f.updated_at as statusUpdatedAt,
            f.is_replied,
            -- 提取用户的第一条消息内容
            m.content as text, 
            m.translated_content as translated_text,
            -- 提取客服回复(如果有)
            (SELECT content FROM voc_feedback_messages WHERE feedback_id = f.id AND role = 'agent' LIMIT 1) as replyText,
            (SELECT created_at FROM voc_feedback_messages WHERE feedback_id = f.id AND role = 'agent' LIMIT 1) as replyDate
        ${baseSql}
    `;

    // 添加排序
    dataSql += ` ORDER BY 
        CASE WHEN f.status IN ('resolved', 'irrelevant') THEN 1 ELSE 0 END ASC,
        f.feedback_time DESC`;

    // 添加分页 - 直接拼接到 SQL 中，避免 mysql2 execute 的参数类型问题
    const limitVal = parseInt(limit);
    const offsetVal = (page - 1) * limitVal;
    dataSql += ` LIMIT ${limitVal} OFFSET ${offsetVal}`;

    // 执行查询 (参数只包含 WHERE 条件的参数)
    const [rows] = await pool.execute(dataSql, params);

    // 格式化返回结构
    const formattedData = rows.map(row => ({
        id: row.id,
        appId: row.appId,
        appName: row.appName,
        source: row.source,
        externalId: row.external_id,
        sourceUrl: row.source_url,
        country: row.country,
        version: row.version,
        userName: row.userName,
        score: row.score,
        date: row.date,
        text: row.text,
        translated_text: row.translated_text,
        replyText: row.replyText,
        replyDate: row.replyDate,
        
        category: row.category,
        risk_level: row.risk_level,
        riskLevel: row.risk_level,
        summary: row.summary,
        root_cause: row.root_cause,
        action_advice: row.action_advice,
        suggested_reply: row.suggested_reply,
        
        status: row.status,
        statusNote: row.statusNote,
        statusUpdatedAt: row.statusUpdatedAt,
        isReplied: !!row.is_replied
    }));

    return {
        data: formattedData,
        meta: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit) || 1
        }
    };
}

/**
 * 分页包装器 (兼容旧接口调用)
 */
export function paginate(data, page = 1, limit = 10) {
    return data; 
}