import React, { useState, useEffect, useCallback } from 'react';
import { VOCItem, ReviewStatus, STATUS_LABELS, AppInfo, Report } from '../types';
import { 
  fetchVocData, 
  batchUpdateStatus, 
  updateReviewStatus, 
  generateAppReport,
  fetchApps,
  fetchReports
} from '../services/api';
import { RiskBadge } from '../components/RiskBadge';
import { NoteModal } from '../components/NoteModal';
import { 
  Search, ChevronLeft, ChevronRight, Calendar, Loader2, FileText, 
  CheckSquare, X, Copy, ExternalLink, Archive, ChevronDown, ChevronUp,
  Check, Ban, Send, Clock, CheckCircle, Loader, CheckCircle2, MessageSquare
} from 'lucide-react';

// 简易 Markdown 解析器
function parseMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
    .replace(/^(?!<[hlo]|<li|<hr)(.+)$/gm, '<p>$1</p>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc list-inside space-y-1 my-2">$&</ul>')
    .replace(/\n{3,}/g, '\n\n');
  
  return html;
}

// 状态配置
const STATUS_CONFIG: Record<ReviewStatus, { 
  bg: string; text: string; border: string; icon: React.ReactNode; label: string;
}> = {
  pending: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: <Clock size={14} />, label: '待处理' },
  irrelevant: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: <Ban size={14} />, label: '无意义' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <CheckCircle size={14} />, label: '已确认' },
  reported: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: <Send size={14} />, label: '已反馈' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Loader size={14} />, label: '处理中' },
  resolved: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: <CheckCircle2 size={14} />, label: '已解决' },
};

// 可折叠文本组件
const ExpandableText: React.FC<{ text: string; maxLength?: number; className?: string }> = ({ 
  text, 
  maxLength = 100,
  className = "" 
}) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!text) return null;
  if (text.length <= maxLength) return <span className={className}>{text}</span>;

  return (
    <span className={className}>
      {expanded ? text : `${text.slice(0, maxLength)}...`}
      <button 
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="ml-1 text-blue-600 hover:text-blue-800 text-xs font-medium inline-flex items-center align-middle"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
    </span>
  );
};

// 操作按钮组件
const ActionButtons: React.FC<{
  currentStatus: ReviewStatus;
  onStatusChange: (status: ReviewStatus) => void;
  onComment: () => void;
  loading?: boolean;
}> = ({ currentStatus, onStatusChange, onComment, loading }) => {
  const getQuickActions = (): { status: ReviewStatus; label: string; color: string }[] => {
    switch (currentStatus) {
      case 'pending':
        return [
          { status: 'confirmed', label: '确认', color: 'bg-blue-500 hover:bg-blue-600' },
          { status: 'irrelevant', label: '无效', color: 'bg-gray-400 hover:bg-gray-500' },
        ];
      case 'confirmed':
        return [
          { status: 'reported', label: '已反馈', color: 'bg-purple-500 hover:bg-purple-600' },
          { status: 'in_progress', label: '处理中', color: 'bg-amber-500 hover:bg-amber-600' },
        ];
      case 'reported':
      case 'in_progress':
        return [
          { status: 'resolved', label: '已解决', color: 'bg-green-500 hover:bg-green-600' },
        ];
      case 'resolved':
        return [
          { status: 'pending', label: '重开', color: 'bg-slate-500 hover:bg-slate-600' },
        ];
      case 'irrelevant':
        return [
          { status: 'pending', label: '恢复', color: 'bg-slate-500 hover:bg-slate-600' },
        ];
      default:
        return [];
    }
  };

  const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const actions = getQuickActions();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
          {config.icon}
          {config.label}
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); onComment(); }}
          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
          title="备注/历史"
        >
          <MessageSquare size={14} />
        </button>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {actions.map(action => (
          <button
            key={action.status}
            onClick={(e) => { e.stopPropagation(); onStatusChange(action.status); }}
            disabled={loading}
            className={`px-1.5 py-0.5 text-xs text-white rounded transition-colors disabled:opacity-50 flex-1 text-center ${action.color}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export const Reports: React.FC = () => {
  const [data, setData] = useState<VOCItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('All');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMeta, setReportMeta] = useState<any>(null);

  const [showArchive, setShowArchive] = useState(false);
  const [archivedReports, setArchivedReports] = useState<Report[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  // 备注弹窗 State
  const [activeNoteReview, setActiveNoteReview] = useState<{id: string, summary: string} | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchApps().then(res => {
      if (res.success) {
        setApps(res.data);
      }
    }).catch(console.error);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {
        page: currentPage,
        limit: pageSize,
        reportMode: true,
        category: categoryFilter,
        risk: riskFilter,
        search: debouncedSearch,
        startDate: dateRange.start,
        endDate: dateRange.end,
        status: statusFilter
      };
      
      if (selectedApp !== 'All') {
        filters.appId = selectedApp;
      }

      const result = await fetchVocData(filters);
      
      let filteredData = result.data || [];
      if (selectedApp !== 'All') {
        filteredData = filteredData.filter(item => item.appId === selectedApp);
      }
      
      setData(filteredData);
      setTotalItems(result.meta.total);
      setTotalPages(result.meta.totalPages);
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Fetch error", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, categoryFilter, riskFilter, debouncedSearch, dateRange, statusFilter, selectedApp]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, categoryFilter, riskFilter, debouncedSearch, dateRange, statusFilter, selectedApp]);

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

  const handleStatusChange = async (id: string, newStatus: ReviewStatus) => {
    setUpdatingId(id);
    try {
      await updateReviewStatus(id, newStatus);
      setData(prev => prev.map(item => 
        item.id === id ? { ...item, status: newStatus } : item
      ));
    } catch (e) {
      console.error('Status update failed', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleGenerateReport = async () => {
    if (selectedApp === 'All') {
      alert('请先选择一个App再生成报告');
      return;
    }
    setGeneratingReport(true);
    try {
      const result = await generateAppReport(selectedApp, {});
      setReportContent(result.report);
      setReportMeta(result.meta);
      setShowReportModal(true);
    } catch (e) {
      console.error('Report generation failed', e);
      alert('报告生成失败，请检查API配置');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleShowArchive = async () => {
    setShowArchive(true);
    setLoadingArchive(true);
    try {
      const res = await fetchReports(selectedApp !== 'All' ? selectedApp : undefined, 30);
      setArchivedReports(res.data || []);
    } catch (e) {
      console.error('Load archive failed', e);
    } finally {
      setLoadingArchive(false);
    }
  };

  const handleViewArchivedReport = (report: Report) => {
    setReportContent(report.content);
    setReportMeta({
      appId: report.app_id,
      appName: report.app_name,
      weekNumber: report.week_number,
      year: report.year
    });
    setShowArchive(false);
    setShowReportModal(true);
  };

  // [修改] 增加年份显示
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric', // 新增年份
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

  const selectedAppInfo = apps.find(a => a.appId === selectedApp);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">问题处理</h2>
          <p className="text-sm text-slate-500">
            {selectedApp !== 'All' 
              ? `${selectedAppInfo?.appName || selectedApp} - 共 ${totalItems} 条待处理`
              : `全部App - 共 ${totalItems} 条`
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleShowArchive}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Archive size={18} />
            报告存档
          </button>
          <button 
            onClick={handleGenerateReport}
            disabled={generatingReport || selectedApp === 'All'}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title={selectedApp === 'All' ? '请先选择一个App' : ''}
          >
            {generatingReport ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileText size={18} />
            )}
            {generatingReport ? '生成中...' : '生成周报'}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 text-sm font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">全部App</option>
            {apps.map(app => (
              <option key={app.appId} value={app.appId}>
                {app.appName} ({app.country})
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="搜索关键词..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
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
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
           <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">分类: 全部</option>
            <option value="Tech_Bug">Tech Bug</option>
            <option value="Compliance_Risk">Compliance Risk</option>
            <option value="Product_Issue">Product Issue</option>
            <option value="User_Error">User Error</option>
            <option value="Other">Other</option>
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">风险: 全部</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="All">状态: 全部</option>
            <option value="pending">待处理</option>
            <option value="confirmed">已确认</option>
            <option value="reported">已反馈</option>
            <option value="in_progress">处理中</option>
            <option value="resolved">已解决</option>
            <option value="irrelevant">无意义</option>
          </select>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={10}>10条/页</option>
            <option value={20}>20条/页</option>
            <option value={50}>50条/页</option>
            <option value={100}>100条/页</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
            <span className="text-sm text-slate-600">
              <CheckSquare size={16} className="inline mr-1" />
              已选 {selectedIds.size} 项
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-500">批量操作:</span>
            <button onClick={() => handleBatchStatusUpdate('confirmed')} disabled={updatingStatus} className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">确认</button>
            <button onClick={() => handleBatchStatusUpdate('reported')} disabled={updatingStatus} className="px-2 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50">已反馈</button>
            <button onClick={() => handleBatchStatusUpdate('resolved')} disabled={updatingStatus} className="px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50">已解决</button>
            <button onClick={() => handleBatchStatusUpdate('irrelevant')} disabled={updatingStatus} className="px-2 py-1 text-xs rounded bg-gray-400 text-white hover:bg-gray-500 disabled:opacity-50">无效</button>
          </div>
        )}
      </div>

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
                <th className="px-4 py-4 w-10">
                  <input 
                    type="checkbox"
                    checked={selectedIds.size === data.length && data.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-4 whitespace-nowrap">时间</th>
                <th className="px-4 py-4 whitespace-nowrap">App</th>
                {/* [修改] 拆分列 */}
                <th className="px-4 py-4 whitespace-nowrap">风险</th>
                <th className="px-4 py-4 whitespace-nowrap">分类</th>
                
                <th className="px-4 py-4 whitespace-nowrap w-[140px]">状态/操作</th>
                <th className="px-4 py-4 whitespace-nowrap min-w-[280px] max-w-[450px]">问题详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 && !loading ? (
                <tr>
                  {/* [修改] colspan 增加到 7 */}
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50' : ''}`} onClick={() => toggleSelect(item.id)}>
                    <td className="px-4 py-4 align-top" onClick={(e) => e.stopPropagation()}>
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
                        <span className="font-medium text-slate-800 text-xs">
                          {item.appName || item.appId}
                        </span>
                        <span className="text-xs text-slate-400">{item.country}</span>
                      </div>
                    </td>
                    {/* [修改] 风险单独列 */}
                    <td className="px-4 py-4 align-top">
                      <RiskBadge level={item.risk_level} />
                    </td>
                    {/* [修改] 分类单独列 */}
                    <td className="px-4 py-4 align-top">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                          ${item.category === 'Compliance_Risk' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                          ${item.category === 'Tech_Bug' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                          ${item.category === 'Product_Issue' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                          ${!['Compliance_Risk', 'Tech_Bug', 'Product_Issue'].includes(item.category) ? 'bg-slate-50 text-slate-600 border-slate-200' : ''}
                        `}>
                          {item.category.replace('_', ' ')}
                        </span>
                    </td>
                    
                    <td className="px-4 py-4 align-top">
                      <ActionButtons 
                        currentStatus={item.status || 'pending'}
                        onStatusChange={(newStatus) => handleStatusChange(item.id, newStatus)}
                        onComment={() => setActiveNoteReview({ id: item.id, summary: item.summary })}
                        loading={updatingId === item.id}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1.5">
                        <p className="font-medium text-slate-800 text-sm">
                          {item.summary}
                        </p>
                        
                        <div className="text-xs text-slate-600 leading-relaxed">
                          <span className="font-semibold text-slate-400 mr-1 select-none">译:</span>
                          <ExpandableText 
                            text={item.translated_text} 
                            maxLength={100}
                          />
                        </div>

                        <div className="text-xs text-slate-400 italic">
                           <span className="font-semibold text-slate-300 mr-1 select-none">原:</span>
                           <ExpandableText 
                            text={item.text} 
                            maxLength={60}
                            className="text-slate-400"
                          />
                          {item.source === 'google_play' && item.sourceUrl && (
                              <a 
                                href={item.sourceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-400 hover:text-blue-600 hover:underline shrink-0"
                                title="前往 Google Play 查看"
                              >
                                <ExternalLink size={12} className="mr-0.5" />
                                <span className="text-[10px]">GP原文</span>
                              </a>
                            )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            第 {currentPage} / {totalPages} 页，共 {totalItems} 条
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-600 font-medium px-2">{currentPage}</span>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
               <div>
                <h3 className="text-lg font-bold text-slate-800">{reportMeta?.appName || 'VOC'} 周报</h3>
                {reportMeta && (
                  <p className="text-sm text-slate-500">
                    {reportMeta.year}年 第{reportMeta.weekNumber}周 · 分析 {reportMeta.totalAnalyzed} 条
                  </p>
                )}
               </div>
               <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-slate prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: reportContent ? parseMarkdown(reportContent) : '' }} />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    if (reportContent) {
                      // ✅ 修复后：使用 Promise 链式调用，并增加错误捕获
                      navigator.clipboard.writeText(reportContent)
                        .then(() => {
                          alert('✅ 已复制到剪贴板');
                        })
                        .catch((err) => {
                          console.error('复制失败:', err);
                          // 备用方案：如果 clipboard API 失败（比如非 HTTPS 环境），尝试传统方法
                          try {
                            const textArea = document.createElement("textarea");
                            textArea.value = reportContent;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            alert('✅ 已复制到剪贴板 (兼容模式)');
                          } catch (e) {
                            alert('❌ 复制失败，请手动选择文本复制');
                          }
                        });
                    }
                  }}
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2"
                >
                  <Copy size={16} /> 复制
                </button>
               <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">关闭</button>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">报告存档</h3>
              <button onClick={() => setShowArchive(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingArchive ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : archivedReports.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  暂无存档报告
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedReports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => handleViewArchivedReport(report)}
                      className="w-full text-left p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-800">{report.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">
                            {report.app_name} · {report.year}年第{report.week_number}周
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <p>待处理: {report.pending_issues}</p>
                          <p>已解决: {report.resolved_issues}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
         </div>
      )}

      {activeNoteReview && (
        <NoteModal
          reviewId={activeNoteReview.id}
          reviewSummary={activeNoteReview.summary}
          onClose={() => setActiveNoteReview(null)}
        />
      )}
    </div>
  );
};