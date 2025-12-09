import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStatusBatch, initStatusBatch } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

/**
 * 递归扫描所有 analyzed_*.json 文件
 */
function getAllAnalyzedFiles(dirPath, arrayOfFiles = []) {
    let files = [];
    try {
        files = fs.readdirSync(dirPath);
    } catch (e) {
        return arrayOfFiles;
    }

    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllAnalyzedFiles(fullPath, arrayOfFiles);
        } else if (file.startsWith('analyzed_') && file.endsWith('.json')) {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

/**
 * 加载所有分析报告（去重）
 */
export function loadAllReports() {
    if (!fs.existsSync(DATA_DIR)) return [];

    const allFilePaths = getAllAnalyzedFiles(DATA_DIR);
    console.log(`[DataLoader] Found ${allFilePaths.length} analyzed files`);

    let allData = [];

    allFilePaths.forEach(filePath => {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(content);
            if (Array.isArray(json)) {
                allData = allData.concat(json);
            } else if (json.data && Array.isArray(json.data)) {
                allData = allData.concat(json.data);
            }
        } catch (e) {
            console.error(`[DataLoader] Read failed: ${filePath}`, e.message);
        }
    });

    // 按ID去重
    const uniqueMap = new Map();
    allData.forEach(item => {
        if (item && item.id) {
            uniqueMap.set(item.id, item);
        }
    });
    
    const uniqueData = Array.from(uniqueMap.values());
    console.log(`[DataLoader] Raw: ${allData.length} -> Unique: ${uniqueData.length}`);
    
    return uniqueData;
}

/**
 * 加载数据并合并状态
 */
export function loadDataWithStatus() {
    let data = loadAllReports();
    
    // 初始化状态
    const allIds = data.map(d => d.id).filter(Boolean);
    if (allIds.length > 0) {
        initStatusBatch(allIds);
    }

    // 合并状态到数据
    const statusMap = getStatusBatch(allIds);
    data = data.map(item => ({
        ...item,
        status: statusMap[item.id]?.status || 'pending',
        statusNote: statusMap[item.id]?.note || '',
        statusUpdatedAt: statusMap[item.id]?.updated_at || null
    }));

    return data;
}

/**
 * 通用筛选函数
 */
export function filterData(data, filters) {
    let filteredData = [...data];
    const { category, risk, country, search, startDate, endDate, status, reportMode } = filters;

    // 状态筛选
    if (status && status !== 'All') {
        filteredData = filteredData.filter(item => item.status === status);
    }

    // 报告模式：过滤掉Low风险和Positive
    if (reportMode === 'true' || reportMode === true) {
        filteredData = filteredData.filter(item => {
            const r = (item.risk_level || item.riskLevel || 'Low');
            const c = (item.category || 'Other');
            return r !== 'Low' && c !== 'Positive';
        });
    }

    if (category && category !== 'All') {
        filteredData = filteredData.filter(item => item.category === category);
    }

    if (risk && risk !== 'All') {
        filteredData = filteredData.filter(item => 
            (item.risk_level === risk) || (item.riskLevel === risk)
        );
    }

    if (country && country !== 'All') {
        filteredData = filteredData.filter(item => item.country === country);
    }

    if (startDate) {
        const start = new Date(startDate).getTime();
        filteredData = filteredData.filter(item => new Date(item.date).getTime() >= start);
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(item => new Date(item.date).getTime() <= end.getTime());
    }

    if (search) {
        const term = search.toString().toLowerCase();
        filteredData = filteredData.filter(item => {
            const text = (item.text || item.originalText || '').toLowerCase();
            const trans = (item.translated_text || item.translatedText || '').toLowerCase();
            const summary = (item.summary || '').toLowerCase();
            return text.includes(term) || trans.includes(term) || summary.includes(term);
        });
    }

    // 按日期排序
    filteredData.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    return filteredData;
}

/**
 * 分页处理
 */
export function paginate(data, page = 1, limit = 10) {
    const total = data.length;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    return {
        data: data.slice(startIndex, endIndex),
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        }
    };
}
