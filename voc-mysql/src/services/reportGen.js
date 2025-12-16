import OpenAI from 'openai';
import { loadAllReports, filterData } from './dataLoader.js';
import { recordAICost } from '../db.js';

// 延迟初始化
let openai = null;

function getOpenAIClient() {
    if (!openai) {
        openai = new OpenAI({
            baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY,
        });
    }
    return openai;
}

// 获取当前日期
function getCurrentDate() {
    return new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

const REPORT_PROMPT = `你是一个专业的金融科技产品运营分析师，负责分析用户反馈(VOC)数据并生成报告。

## 输出要求
1. 使用中文撰写
2. 使用 Markdown 格式
3. **禁止使用表格**，改用列表形式展示数据
4. 结构清晰，层次分明
5. 数据准确，不要编造数字
6. **不要在报告中写生成时间**，系统会自动添加

## 报告结构
1. **概览** - 数据时间范围、总量、市场分布（用列表展示）
2. **问题分类统计** - 各类别数量和占比（用列表展示）
3. **高频问题** - TOP 5 高频问题及具体表现
4. **紧急问题** - 需要立即处理的高风险项（标注优先级）
5. **改进建议** - 分为：
   - 立即行动（24-48小时内）
   - 短期优化（1-2周）
   - 中期规划（1个月内）
6. **总结** - 2-3句话总结核心发现和行动重点

## 风格要求
- 直接、简洁、可执行
- 使用 bullet points 而非长段落
- 高风险项用 **加粗** 标注
- 给出具体、可操作的建议，而非泛泛而谈
`;

/**
 * 准备报告数据摘要
 */
function prepareReportSummary(data) {
    const categoryStats = {};
    const riskStats = { High: 0, Medium: 0 };
    const countryStats = {};
    const summaries = [];

    // 找出日期范围
    let minDate = null;
    let maxDate = null;

    data.forEach(item => {
        const cat = item.category || 'Other';
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;

        const risk = item.risk_level || item.riskLevel || 'Medium';
        if (riskStats[risk] !== undefined) riskStats[risk]++;

        const country = item.country || 'Unknown';
        countryStats[country] = (countryStats[country] || 0) + 1;

        // 日期范围
        if (item.date) {
            const d = new Date(item.date);
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        }

        if (item.summary) {
            summaries.push({
                category: cat,
                risk: risk,
                summary: item.summary,
                country: country,
                date: item.date
            });
        }
    });

    // 格式化日期
    const formatDate = (d) => d ? d.toLocaleDateString('zh-CN') : 'N/A';

    return {
        totalCount: data.length,
        dateRange: {
            start: formatDate(minDate),
            end: formatDate(maxDate)
        },
        categoryStats,
        riskStats,
        countryStats,
        // 按风险排序，高风险优先
        topIssues: summaries
            .sort((a, b) => {
                const riskOrder = { High: 0, Medium: 1, Low: 2 };
                return (riskOrder[a.risk] || 2) - (riskOrder[b.risk] || 2);
            })
            .slice(0, 50)
    };
}

/**
 * 生成 AI 报告
 */
export async function generateReport(filters = {}, limit = 100) {
    let data = loadAllReports();
    
    filters.reportMode = true;
    data = filterData(data, filters);
    
    const reportData = data.slice(0, limit);
    
    if (reportData.length === 0) {
        return {
            success: false,
            report: '没有找到符合条件的数据',
            meta: { totalAnalyzed: 0, generatedAt: new Date().toISOString() }
        };
    }

    const summary = prepareReportSummary(reportData);

    const client = getOpenAIClient();
    
    const completion = await client.chat.completions.create({
        messages: [
            { role: "system", content: REPORT_PROMPT },
            { 
                role: "user", 
                content: `请根据以下VOC数据生成分析报告。

## 数据摘要
- 数据总量：${summary.totalCount} 条
- 时间范围：${summary.dateRange.start} 至 ${summary.dateRange.end}
- 国家分布：${JSON.stringify(summary.countryStats)}
- 问题分类：${JSON.stringify(summary.categoryStats)}
- 风险分布：${JSON.stringify(summary.riskStats)}

## 具体问题列表（按风险排序）
${JSON.stringify(summary.topIssues, null, 2)}

请生成分析报告：`
            }
        ],
        model: "deepseek-chat",
        temperature: 0.2,
        max_tokens: 3000
    });

    // 记录费用
    if (completion.usage) {
        await recordAICost('deepseek', 'deepseek-chat', 'report', completion.usage);
    }

    let report = completion.choices[0].message.content;
    
    // 在报告末尾添加元信息
    const currentDate = getCurrentDate();
    report += `\n\n---\n*报告生成时间：${currentDate}*`;

    return {
        success: true,
        report,
        meta: {
            totalAnalyzed: reportData.length,
            generatedAt: new Date().toISOString()
        }
    };
}
