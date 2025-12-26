// pages/IssueHandler.tsx 完整代码实现
import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ArrowLeft, MessageSquare, AlertCircle, 
  Loader2, LayoutGrid, FileText, ExternalLink, Search, Filter, Settings2 
} from 'lucide-react';
import { fetchApps } from '../services/api';
import { formatDate } from '../tools';

const API_BASE = '/api';

export const IssueHandler: React.FC = () => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [apps, setApps] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 筛选与搜索状态
  const [filters, setFilters] = useState({ appId: '', year: 2025, month: 12 });
  const [detailFilters, setDetailFilters] = useState({ keyword: '', source: 'google_play' });
  
  // 状态流转弹窗状态
  const [showStatusModal, setShowStatusModal] = useState<any>(null);

  useEffect(() => {
    const initApps = async () => {
      const res = await fetchApps();
      if (res.data?.length > 0) {
        setApps(res.data);
        setFilters(f => ({ ...f, appId: res.data[0].appId }));
      }
    };
    initApps();
  }, []);

  useEffect(() => {
    if (filters.appId && view === 'list') loadGroups();
  }, [filters, view]);

  // 详情页筛选监听
  useEffect(() => {
    if (view === 'detail' && selectedGroup) loadReviews();
  }, [detailFilters]);

  const loadGroups = async () => {
    setLoading(true);
    const params = new URLSearchParams({ ...filters } as any);
    const res = await fetch(`${API_BASE}/groups?${params}`).then(r => r.json());
    setGroups(res.data || []);
    setLoading(false);
  };

  const loadReviews = async () => {
    const params = new URLSearchParams({ 
      keyword: detailFilters.keyword, 
      source: detailFilters.source 
    });
    const res = await fetch(`${API_BASE}/groups/${selectedGroup.id}/reviews?${params}`).then(r => r.json());
    setReviews(res.data || []);
  };

  const handleUpdateProcessing = async (id: number, status: string, remark: string) => {
    await fetch(`${API_BASE}/groups/${id}/processing`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remark, operator: 'Admin' })
    });
    setShowStatusModal(null);
    loadGroups();
  };

  const handleEnterDetail = async (group: any) => {
    setLoading(true);
    setSelectedGroup(group);
    
    // 立即执行第一次加载，不完全依赖 useEffect
    const initialParams = new URLSearchParams({ 
      keyword: '', 
      source: detailFilters.source // 使用当前定义的默认来源
    });
    
    try {
      const res = await fetch(`${API_BASE}/groups/${group.id}/reviews?${initialParams}`).then(r => r.json());
      setReviews(res.data || []);
      setView('detail');
    } catch (e) {
      console.error("加载详情失败", e);
    } finally {
      setLoading(false);
    }
  };

  // 列表视图：增加状态展示和操作入口
  const renderListView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">问题治理中心</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"><FileText size={18} /> 生成治理周报</button>
      </div>

      <div className="bg-white p-4 rounded-xl border flex gap-4 shadow-sm items-center">
        <select className="bg-slate-50 border rounded-lg px-3 py-2 text-sm font-bold" value={filters.appId} onChange={e => setFilters({...filters, appId: e.target.value})}>
          {apps.map(app => <option key={app.appId} value={app.appId}>{app.appName}</option>)}
        </select>
        <div className="flex gap-2 text-sm">
          <input type="number" className="w-20 border rounded px-2" value={filters.year} onChange={e => setFilters({...filters, year: parseInt(e.target.value)})} />
          <span>年</span>
          <select className="border rounded px-2" value={filters.month} onChange={e => setFilters({...filters, month: parseInt(e.target.value)})}>
            {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {groups.map(group => (
          <div key={group.id} className="bg-white border p-5 rounded-xl hover:shadow-lg transition-all flex items-center justify-between group">
            <div className="flex items-center gap-5 flex-1 cursor-pointer" onClick={() => handleEnterDetail(group)}>
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center font-bold">{group.group_rank}</div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600">{group.group_title}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    group.processing_status === 'resolved' ? 'bg-green-100 text-green-700' : 
                    group.processing_status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {group.processing_status === 'resolved' ? '已解决' : group.processing_status === 'processing' ? '处理中' : '待处理'}
                  </span>
                  <span>{group.review_count} 条评论</span>
                  {group.remark && <span className="text-amber-600 truncate max-w-[200px]">注: {group.remark}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => setShowStatusModal(group)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"><Settings2 size={20} /></button>
          </div>
        ))}
      </div>

      {/* 状态流转 Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <h3 className="font-bold mb-4 text-lg">处理状态流转</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-slate-600">处理进度</label>
                <select id="statusSelect" className="w-full border rounded-lg p-2" defaultValue={showStatusModal.processing_status}>
                  <option value="pending">待处理</option>
                  <option value="processing">处理中</option>
                  <option value="resolved">已解决</option>
                  <option value="ignored">忽略</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 text-slate-600">备注说明</label>
                <textarea id="remarkInput" className="w-full border rounded-lg p-2 h-24" defaultValue={showStatusModal.remark} placeholder="填写处理进度或结论..."></textarea>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowStatusModal(null)} className="px-4 py-2 text-slate-500">取消</button>
                <button 
                  onClick={() => handleUpdateProcessing(
                    showStatusModal.id, 
                    (document.getElementById('statusSelect') as HTMLSelectElement).value,
                    (document.getElementById('remarkInput') as HTMLTextAreaElement).value
                  )}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 详情视图：增加关键字筛选和来源跳转
  const renderDetailView = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('list')} className="text-slate-500 hover:text-blue-600"><ArrowLeft size={20} /></button>
        <h2 className="text-xl font-bold">{selectedGroup.group_title}</h2>
      </div>

      {/* 筛选工具栏 */}
      <div className="bg-white p-4 rounded-xl border flex gap-4 shadow-sm items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input 
            type="text" placeholder="搜索关键字..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            value={detailFilters.keyword}
            onChange={e => setDetailFilters({...detailFilters, keyword: e.target.value})}
          />
        </div>
        <select 
          className="border rounded-lg px-3 py-2 text-sm"
          value={detailFilters.source}
          onChange={e => setDetailFilters({...detailFilters, source: e.target.value})}
        >
          <option value="">所有来源</option>
          <option value="google_play">Google Play</option>
          <option value="udesk">Udesk 客服</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="divide-y">
            {reviews.map((rev) => (
            <div key={rev.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    {/* 来源标签 */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    rev.source === 'google_play' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                    {rev.source === 'google_play' ? 'Google Play' : 'Udesk'}
                    </span>
                    <span className="text-xs text-slate-500">{rev.country} · {formatDate(rev.date)}</span>
                    
                    {/* 如果是 Udesk，展示原始 ID */}
                    {rev.source !== 'google_play' && rev.id && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                        ID: {rev.id}
                    </span>
                    )}
                </div>

                {/* GP 原文跳转 */}
                {rev.source === 'google_play' && rev.sourceUrl && (
                    <a 
                    href={rev.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 flex items-center gap-1 text-xs hover:underline"
                    >
                    查看 GP 详情 <ExternalLink size={12} />
                    </a>
                )}
                </div>

                {/* 翻译内容（主要展示） */}
                <p className="text-slate-800 text-sm leading-relaxed font-medium">
                {rev.translated_text || rev.text}
                </p>

                {/* 原文内容（折叠展示或小字展示） */}
                {(rev.translated_text && rev.text) && (
                <div className="mt-3 p-3 bg-slate-50 rounded border-l-2 border-slate-200">
                    <p className="text-xs text-slate-500 italic">
                    <span className="font-bold mr-1 text-slate-400">原文:</span>
                    {rev.text}
                    </p>
                </div>
                )}
            </div>
            ))}
        </div>
      </div>
    </div>
  );

  return view === 'list' ? renderListView() : renderDetailView();
};