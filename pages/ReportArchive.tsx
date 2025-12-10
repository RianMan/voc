import React, { useState, useEffect } from 'react';
import { Report, AppInfo } from '../types';
import { fetchReports, fetchApps } from '../services/api';
import { FileText, ChevronRight, Loader2, X, Copy, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Markdown解析
function parseMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 text-slate-800">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-4 text-slate-900 border-b pb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
    .replace(/^(?!<[hlo]|<li|<hr)(.+)$/gm, '<p class="my-2 text-slate-600">$1</p>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>');
}

export const ReportArchive: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string>('All');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    loadApps();
    loadReports();
  }, []);

  useEffect(() => {
    loadReports();
  }, [selectedApp]);

  const loadApps = async () => {
    try {
      const res = await fetchApps();
      setApps(res.data || []);
    } catch (e) {
      console.error('Load apps failed', e);
    }
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetchReports(selectedApp !== 'All' ? selectedApp : undefined, 50);
      setReports(res.data || []);
    } catch (e) {
      console.error('Load reports failed', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 按App分组报告
  const groupedReports = reports.reduce((acc, report) => {
    const key = report.app_id;
    if (!acc[key]) {
      acc[key] = {
        appId: report.app_id,
        appName: report.app_name,
        reports: []
      };
    }
    acc[key].reports.push(report);
    return acc;
  }, {} as Record<string, { appId: string; appName: string; reports: Report[] }>);

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp size={14} className="text-red-500" />;
    if (current < previous) return <TrendingDown size={14} className="text-green-500" />;
    return <Minus size={14} className="text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">报告存档</h2>
          <p className="text-sm text-slate-500">查看历史周报，追踪问题趋势</p>
        </div>
        
        <select 
          value={selectedApp}
          onChange={(e) => setSelectedApp(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">全部App</option>
          {apps.map(app => (
            <option key={app.appId} value={app.appId}>
              {app.appName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无报告存档</p>
          <p className="text-sm text-slate-400 mt-2">生成周报后会自动保存到这里</p>
        </div>
      ) : selectedApp === 'All' ? (
        // 按App分组显示
        <div className="space-y-6">
          {Object.values(groupedReports).map(group => (
            <div key={group.appId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">{group.appName}</h3>
                <p className="text-sm text-slate-500">{group.reports.length} 份报告</p>
              </div>
              <div className="divide-y divide-slate-100">
                {group.reports.slice(0, 5).map(report => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{report.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{formatDate(report.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs">
                        <p className="text-slate-600">待处理 <span className="font-bold text-amber-600">{report.pending_issues}</span></p>
                        <p className="text-slate-600">已解决 <span className="font-bold text-green-600">{report.resolved_issues}</span></p>
                      </div>
                      <ChevronRight size={20} className="text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // 单App时间线视图
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {reports.map((report, index) => {
              const prevReport = reports[index + 1];
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-sm">W{report.week_number}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{report.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{formatDate(report.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-400">新增</p>
                        <p className="font-bold text-slate-700">{report.new_issues}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">待处理</p>
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-amber-600">{report.pending_issues}</span>
                          {prevReport && getTrendIcon(report.pending_issues, prevReport.pending_issues)}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">已解决</p>
                        <p className="font-bold text-green-600">{report.resolved_issues}</p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{selectedReport.title}</h3>
                <p className="text-sm text-slate-500">
                  {selectedReport.year}年 第{selectedReport.week_number}周 · {formatDate(selectedReport.created_at)}
                </p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            {/* Stats Summary */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-slate-500">总问题</p>
                <p className="text-xl font-bold text-slate-800">{selectedReport.total_issues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">新增</p>
                <p className="text-xl font-bold text-blue-600">{selectedReport.new_issues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">待处理</p>
                <p className="text-xl font-bold text-amber-600">{selectedReport.pending_issues}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">已解决</p>
                <p className="text-xl font-bold text-green-600">{selectedReport.resolved_issues}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-slate prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedReport.content) }} 
              />
            </div>
            
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedReport.content);
                  alert('已复制到剪贴板');
                }}
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2"
              >
                <Copy size={16} /> 复制
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([selectedReport.content], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${selectedReport.title}.md`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
              >
                <Download size={16} /> 下载
              </button>
              <button onClick={() => setSelectedReport(null)} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
