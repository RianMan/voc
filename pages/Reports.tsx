import React, { useState, useEffect, useCallback } from 'react';
import { VOCItem, ReviewStatus, STATUS_LABELS } from '../types';
import { fetchVocData, batchUpdateStatus, updateReviewStatus, generateReport } from '../services/api';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { Search, ChevronLeft, ChevronRight, Calendar, Loader2, FileText, CheckSquare, X, Copy, Download } from 'lucide-react';

// 简易 Markdown 解析器
function parseMarkdown(md: string): string {
  let html = md
    // 转义HTML特殊字符
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 代码块
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm">$1</code>')
    // 无序列表
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 分隔线
    .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
    // 段落 (连续的非空行)
    .replace(/^(?!<[hlo]|<li|<hr)(.+)$/gm, '<p>$1</p>')
    // 包装连续的 li
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc list-inside space-y-1 my-2">$&</ul>')
    // 清理多余空行
    .replace(/\n{3,}/g, '\n\n');
  
  return html;
}

export const Reports: React.FC = () => {
  // State
  const [data, setData] = useState<VOCItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Report State
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        const result = await fetchVocData({
        page: currentPage,
        limit: pageSize,
        reportMode: true, 
        category: categoryFilter,
        risk: riskFilter,
        country: countryFilter,
        search: debouncedSearch,
        startDate: dateRange.start,
        endDate: dateRange.end,
        status: statusFilter
        } as any);
        
        setData(result.data || []);
        setTotalItems(result.meta.total);
        setTotalPages(result.meta.totalPages);
        setSelectedIds(new Set()); // Clear selection on data change
    } catch (e) {
        console.error("Fetch error", e);
        setData([]);
    } finally {
        setLoading(false);
    }
  }, [currentPage, pageSize, categoryFilter, riskFilter, countryFilter, debouncedSearch, dateRange, statusFilter]);

  // Trigger fetch when filters change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filters change (except page itself)
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, categoryFilter, riskFilter, countryFilter, debouncedSearch, dateRange, statusFilter]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Batch status update
  const handleBatchStatusUpdate = async (newStatus: ReviewStatus) => {
    if (selectedIds.size === 0) return;
    
    setUpdatingStatus(true);
    try {
      await batchUpdateStatus(Array.from(selectedIds), newStatus);
      await loadData();
    } catch (e) {
      console.error('Status update failed', e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Single status update
  const handleStatusChange = async (id: string, newStatus: ReviewStatus) => {
    try {
      await updateReviewStatus(id, newStatus);
      // Update local state
      setData(prev => prev.map(item => 
        item.id === id ? { ...item, status: newStatus } : item
      ));
    } catch (e) {
      console.error('Status update failed', e);
    }
  };

  // Generate AI Report
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const result = await generateReport({
        category: categoryFilter !== 'All' ? categoryFilter : undefined,
        risk: riskFilter !== 'All' ? riskFilter : undefined,
        country: countryFilter !== 'All' ? countryFilter : undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined
      }, 100);
      
      setReportContent(result.report);
      setShowReportModal(true);
    } catch (e) {
      console.error('Report generation failed', e);
      alert('报告生成失败，请检查API配置');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Format Date Helper
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Raw Data Reports</h2>
          <p className="text-sm text-slate-500">Filtered Issues Only (Medium/High Risk). Total: {totalItems}</p>
        </div>
        
        <button 
          onClick={handleGenerateReport}
          disabled={generatingReport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          {generatingReport ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileText size={18} />
          )}
          {generatingReport ? 'Generating...' : 'Generate AI Report'}
        </button>
      </div>

      {/* Filters Toolbar - Removed 'sticky top-0' */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Search keywords (server-side)..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            </div>
            
            {/* Date Range */}
            <div className="flex gap-2 items-center">
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="pl-10 pr-2 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <span className="text-slate-400">-</span>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="pl-10 pr-2 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {/* Category Filter */}
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">Category: All</option>
            <option value="Tech_Bug">Tech Bug</option>
            <option value="Compliance_Risk">Compliance Risk</option>
            <option value="Product_Issue">Product Issue</option>
            <option value="User_Error">User Error</option>
            <option value="Other">Other</option>
          </select>

          {/* Risk Filter */}
          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">Risk: All Issues</option>
            <option value="High">Risk: High</option>
            <option value="Medium">Risk: Medium</option>
          </select>

          <select 
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">Country: All</option>
            <option value="PK">Pakistan</option>
            <option value="MX">Mexico</option>
            <option value="PH">Philippines</option>
            <option value="ID">Indonesia</option>
            <option value="TH">Thailand</option>
          </select>

          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">Status: All</option>
            <option value="pending">待处理</option>
            <option value="confirmed">已确认</option>
            <option value="reported">已反馈</option>
            <option value="in_progress">处理中</option>
            <option value="resolved">已解决</option>
            <option value="irrelevant">无意义</option>
          </select>
        </div>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
            <span className="text-sm text-slate-600">
              <CheckSquare size={16} className="inline mr-1" />
              已选 {selectedIds.size} 项
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-500">批量设为:</span>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleBatchStatusUpdate(key as ReviewStatus)}
                disabled={updatingStatus}
                className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto relative min-h-[400px]">
          {loading && (
             <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                 <Loader2 className="animate-spin text-blue-600" size={32} />
             </div>
          )}
          <table className="w-full text-sm text-left relative">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 whitespace-nowrap bg-slate-50 w-10">
                  <input 
                    type="checkbox"
                    checked={selectedIds.size === data.length && data.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-4 whitespace-nowrap bg-slate-50">Date</th>
                <th className="px-4 py-4 whitespace-nowrap bg-slate-50">App Info</th>
                <th className="px-4 py-4 whitespace-nowrap bg-slate-50">Risk</th>
                <th className="px-4 py-4 whitespace-nowrap bg-slate-50">Category</th>
                <th className="px-4 py-4 whitespace-nowrap min-w-[140px] bg-slate-50">Status</th>
                <th className="px-4 py-4 whitespace-nowrap min-w-[280px] bg-slate-50">Content Analysis</th>
                <th className="px-4 py-4 whitespace-nowrap min-w-[200px] bg-slate-50">Original Text</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No records found matching your filters.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-4 align-top">
                      <input 
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-4 text-slate-600 align-top whitespace-nowrap font-mono text-xs">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 flex items-center gap-2">
                           {item.country} 
                           {item.appName && <span className="font-normal text-slate-500 text-xs">| {item.appName}</span>}
                        </span>
                        <span className="text-xs text-slate-400 font-mono mt-1">{item.appId}</span>
                        {item.version && (
                           <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded w-fit">
                             v{item.version}
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <RiskBadge level={item.risk_level} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border
                        ${item.category === 'Compliance_Risk' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                        ${item.category === 'Tech_Bug' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                        ${item.category === 'Product_Issue' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                        ${!['Compliance_Risk', 'Tech_Bug', 'Product_Issue'].includes(item.category) ? 'bg-slate-50 text-slate-600 border-slate-200' : ''}
                      `}>
                        {item.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top whitespace-nowrap min-w-[140px]">
                      <StatusBadge 
                        status={item.status || 'pending'} 
                        onChange={(newStatus) => handleStatusChange(item.id, newStatus)} 
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <p className="font-bold text-slate-800 text-sm">
                          {item.summary}
                        </p>
                        <p className="text-slate-600 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                          <span className="font-semibold text-slate-400 block mb-1">Translated:</span>
                          {item.translated_text}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-slate-500 italic text-xs max-w-xs break-words">
                        "{item.text}"
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
             <div className="text-xs text-slate-500">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
             </div>
             
             {/* Page Size Selector */}
             <select 
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded p-1 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
             >
                 <option value={10}>10 / page</option>
                 <option value={20}>20 / page</option>
                 <option value={50}>50 / page</option>
                 <option value={100}>100 / page</option>
                 <option value={200}>200 / page</option>
             </select>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600 font-medium px-2">
               {currentPage}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">AI Analysis Report</h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {/* Markdown 渲染 */}
              <div className="prose prose-slate prose-sm max-w-none
                prose-headings:text-slate-800 prose-headings:font-bold
                prose-h1:text-xl prose-h1:border-b prose-h1:border-slate-200 prose-h1:pb-2
                prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3
                prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-li:text-slate-600
                prose-strong:text-slate-800
                prose-ul:my-2 prose-ol:my-2
                prose-li:my-0.5
              ">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: reportContent ? parseMarkdown(reportContent) : '' 
                  }} 
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (reportContent) {
                    navigator.clipboard.writeText(reportContent);
                    alert('已复制到剪贴板');
                  }
                }}
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2"
              >
                <Copy size={16} />
                复制
              </button>
              <button
                onClick={() => {
                  if (reportContent) {
                    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const date = new Date().toISOString().split('T')[0];
                    link.href = url;
                    link.download = `VOC_Report_${date}.md`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }
                }}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
              >
                <Download size={16} />
                下载 Markdown
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
