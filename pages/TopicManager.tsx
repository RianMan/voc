import React, { useState, useEffect } from 'react';
import { 
  fetchTopics, createTopic, updateTopic, deleteTopic, 
  scanTopics, analyzeTopic, fetchTopicHistory,
  fetchApps, TopicConfig, TopicAnalysis, AppInfo
} from '../services/api';
import { 
  Search, Plus, Trash2, Edit2, Play, RefreshCw, X, 
  Loader2, Tag, Globe, MapPin, Smartphone, TrendingUp, TrendingDown
} from 'lucide-react';

export const TopicManager: React.FC = () => {
  const [topics, setTopics] = useState<TopicConfig[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  
  // 筛选
  const [filterScope, setFilterScope] = useState<string>('');
  const [filterApp, setFilterApp] = useState<string>('');
  
  // 弹窗
  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicConfig | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<{ topic: TopicConfig; history: TopicAnalysis[] } | null>(null);
  
  // 表单
  const [form, setForm] = useState({
    name: '',
    description: '',
    keywords: '',
    scope: 'global' as 'global' | 'country' | 'app',
    country: '',
    appId: ''
  });

  useEffect(() => {
    loadData();
  }, [filterScope, filterApp]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsRes, appsRes] = await Promise.all([
        fetchTopics({ scope: filterScope || undefined, appId: filterApp || undefined }),
        fetchApps()
      ]);
      setTopics(topicsRes.data || []);
      setApps(appsRes.data || []);
    } catch (e) {
      console.error('Load failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTopic(null);
    setForm({ name: '', description: '', keywords: '', scope: 'global', country: '', appId: '' });
    setShowModal(true);
  };

  const handleEdit = (topic: TopicConfig) => {
    setEditingTopic(topic);
    setForm({
      name: topic.name,
      description: topic.description || '',
      keywords: topic.keywords.join(', '),
      scope: topic.scope,
      country: topic.country || '',
      appId: topic.app_id || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const data = {
      name: form.name,
      description: form.description,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      scope: form.scope,
      country: form.scope !== 'global' ? form.country : undefined,
      appId: form.scope === 'app' ? form.appId : undefined
    };

    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, data);
      } else {
        await createTopic(data);
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      alert('保存失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该专题？')) return;
    await deleteTopic(id);
    loadData();
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanTopics(filterApp || undefined);
      alert(`扫描完成！扫描 ${result.scanned} 条，匹配 ${result.matched} 条`);
      loadData();
    } catch (e) {
      alert('扫描失败');
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyze = async (topic: TopicConfig) => {
    setAnalyzing(topic.id);
    try {
      await analyzeTopic(topic.id);
      const historyRes = await fetchTopicHistory(topic.id);
      setShowAnalysis({ topic, history: historyRes.data || [] });
    } catch (e) {
      alert('分析失败');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleViewHistory = async (topic: TopicConfig) => {
    const historyRes = await fetchTopicHistory(topic.id);
    setShowAnalysis({ topic, history: historyRes.data || [] });
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'global': return <Globe size={14} className="text-blue-500" />;
      case 'country': return <MapPin size={14} className="text-green-500" />;
      case 'app': return <Smartphone size={14} className="text-purple-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">专题管理</h2>
          <p className="text-sm text-slate-500">配置关键词监控，追踪特定活动或功能反馈</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
          >
            {scanning ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {scanning ? '扫描中...' : '执行扫描'}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus size={18} /> 新建专题
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4">
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">所有作用域</option>
          <option value="global">全局</option>
          <option value="country">国家级</option>
          <option value="app">App级</option>
        </select>
        <select
          value={filterApp}
          onChange={(e) => setFilterApp(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">所有App</option>
          {apps.map(app => (
            <option key={app.appId} value={app.appId}>{app.appName}</option>
          ))}
        </select>
      </div>

      {/* Topic List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : topics.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Tag size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无专题配置</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map(topic => (
            <div key={topic.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getScopeIcon(topic.scope)}
                  <h3 className="font-semibold text-slate-800">{topic.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(topic)} className="p-1.5 hover:bg-slate-100 rounded">
                    <Edit2 size={14} className="text-slate-400" />
                  </button>
                  <button onClick={() => handleDelete(topic.id)} className="p-1.5 hover:bg-red-50 rounded">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
              
              {topic.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{topic.description}</p>
              )}
              
              <div className="flex flex-wrap gap-1 mb-3">
                {topic.keywords.slice(0, 5).map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                    {kw}
                  </span>
                ))}
                {topic.keywords.length > 5 && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                    +{topic.keywords.length - 5}
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className={`text-xs px-2 py-0.5 rounded ${topic.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {topic.is_active ? '启用中' : '已停用'}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewHistory(topic)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    历史
                  </button>
                  <button
                    onClick={() => handleAnalyze(topic)}
                    disabled={analyzing === topic.id}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    {analyzing === topic.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    分析
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingTopic ? '编辑专题' : '新建专题'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">专题名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="如：双十一活动"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">关键词（逗号分隔）</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="人脸, 识别, 失败"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">作用域</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="global">全局（所有App）</option>
                  <option value="country">国家级</option>
                  <option value="app">App级</option>
                </select>
              </div>
              
              {form.scope !== 'global' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">国家</label>
                  <select
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">选择国家</option>
                    <option value="PK">Pakistan</option>
                    <option value="MX">Mexico</option>
                    <option value="PH">Philippines</option>
                    <option value="ID">Indonesia</option>
                    <option value="TH">Thailand</option>
                  </select>
                </div>
              )}
              
              {form.scope === 'app' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">App</label>
                  <select
                    value={form.appId}
                    onChange={(e) => setForm({ ...form, appId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="">选择App</option>
                    {apps.map(app => (
                      <option key={app.appId} value={app.appId}>{app.appName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis History Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold">「{showAnalysis.topic.name}」分析历史</h3>
              <button onClick={() => setShowAnalysis(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {showAnalysis.history.length === 0 ? (
                <p className="text-center text-slate-400 py-8">暂无分析记录</p>
              ) : (
                showAnalysis.history.map(analysis => (
                  <div key={analysis.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-800">{analysis.analysis_date}</span>
                      <span className="text-xs text-slate-500">匹配 {analysis.total_matches} 条</span>
                    </div>
                    
                    <div className="flex gap-4 mb-3 text-sm">
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp size={14} /> 正面 {analysis.sentiment_positive}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <TrendingDown size={14} /> 负面 {analysis.sentiment_negative}
                      </span>
                      <span className="text-slate-500">中性 {analysis.sentiment_neutral}</span>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-3">{analysis.ai_summary}</p>
                    
                    {analysis.pain_points?.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs font-medium text-slate-500">痛点：</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.pain_points.map((p, i) => (
                            <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
