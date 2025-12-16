import React, { useState, useEffect } from 'react';
import { 
  fetchClusters, runClustering, runWeeklyClustering, fetchClusterSummary,
  fetchApps, IssueCluster, AppInfo
} from '../services/api';
import { 
  Layers, Play, RefreshCw, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, Bug, Package, TrendingUp
} from 'lucide-react';

const CATEGORIES = [
  { value: 'Tech_Bug', label: '技术Bug', icon: Bug, color: 'amber' },
  { value: 'Compliance_Risk', label: '合规风险', icon: AlertTriangle, color: 'red' },
  { value: 'Product_Issue', label: '产品问题', icon: Package, color: 'blue' }
];

export const ClusterAnalysis: React.FC = () => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tech_Bug');
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadClusters();
    }
  }, [selectedApp, selectedCategory]);

  const loadApps = async () => {
    const res = await fetchApps();
    setApps(res.data || []);
    if (res.data?.length > 0) {
      setSelectedApp(res.data[0].appId);
    }
  };

  const loadClusters = async () => {
    setLoading(true);
    try {
      const res = await fetchClusters({ 
        appId: selectedApp, 
        category: selectedCategory 
      });
      setClusters(res.data || []);
    } catch (e) {
      console.error('Load clusters failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunClustering = async () => {
    if (!selectedApp) return;
    setRunning(true);
    try {
      const result = await runClustering(selectedApp, selectedCategory, startDate, endDate);
      if (result.success) {
        alert(`聚类完成！分析 ${result.totalAnalyzed} 条，生成 ${result.clustersCreated} 个聚类`);
        loadClusters();
      } else if (result.skipped) {
        alert(`数据量不足（${result.count}条），跳过聚类`);
      } else {
        alert('聚类失败: ' + (result.error || '未知错误'));
      }
    } catch (e) {
      alert('聚类失败');
    } finally {
      setRunning(false);
    }
  };

  const handleRunAll = async () => {
    if (!confirm('确定执行全量周聚类？这可能需要几分钟时间')) return;
    setRunningAll(true);
    try {
      const result = await runWeeklyClustering();
      alert(`全量聚类完成！成功 ${result.summary.success}，失败 ${result.summary.failed}，跳过 ${result.summary.skipped}`);
      loadClusters();
    } catch (e) {
      alert('执行失败');
    } finally {
      setRunningAll(false);
    }
  };

  const getCategoryConfig = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
  };

  // 按周分组
  const groupedByWeek = clusters.reduce((acc, cluster) => {
    const key = `${cluster.year}W${cluster.week_number}`;
    if (!acc[key]) {
      acc[key] = { year: cluster.year, week: cluster.week_number, clusters: [] };
    }
    acc[key].clusters.push(cluster);
    return acc;
  }, {} as Record<string, { year: number; week: number; clusters: IssueCluster[] }>);

  const weeks = Object.values(groupedByWeek).sort((a, b) => 
    b.year * 100 + b.week - (a.year * 100 + a.week)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">问题聚类分析</h2>
          <p className="text-sm text-slate-500">将同类问题聚合，提炼 Top 痛点</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunAll}
            disabled={runningAll}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50"
          >
            {runningAll ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            全量聚类
          </button>
          <button
            onClick={handleRunClustering}
            disabled={running || !selectedApp}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            执行聚类
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4">
        <select
          value={selectedApp}
          onChange={(e) => setSelectedApp(e.target.value)}
          className="px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 text-sm font-medium text-blue-700"
        >
          <option value="">选择App</option>
          {apps.map(app => (
            <option key={app.appId} value={app.appId}>{app.appName}</option>
          ))}
        </select>
        
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${selectedCategory === cat.value 
                  ? `bg-${cat.color}-100 text-${cat.color}-700 border border-${cat.color}-200` 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              <cat.icon size={16} />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">开始日期</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">结束日期</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
          </div>
          <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-sm text-blue-600">清除</button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : weeks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Layers size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无聚类结果</p>
          <p className="text-sm text-slate-400 mt-2">点击"执行聚类"开始分析</p>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map(weekData => (
            <div key={`${weekData.year}W${weekData.week}`} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="font-bold text-slate-800">
                  {weekData.year}年 第{weekData.week}周
                </h3>
                <p className="text-sm text-slate-500">
                  {getCategoryConfig(selectedCategory).label} · {weekData.clusters.length} 个聚类
                </p>
              </div>
              
              <div className="divide-y divide-slate-100">
                {weekData.clusters.sort((a, b) => a.cluster_rank - b.cluster_rank).map(cluster => (
                  <div key={cluster.id} className="p-5">
                    <div 
                      className="flex items-start justify-between cursor-pointer"
                      onClick={() => setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg
                          ${cluster.cluster_rank === 1 ? 'bg-red-100 text-red-700' : 
                            cluster.cluster_rank === 2 ? 'bg-orange-100 text-orange-700' :
                            cluster.cluster_rank === 3 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'}`}
                        >
                          {cluster.cluster_rank}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800">{cluster.cluster_title}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span>涉及 <strong className="text-slate-700">{cluster.review_count}</strong> 条</span>
                            <span>占比 <strong className="text-slate-700">{cluster.percentage}%</strong></span>
                          </div>
                        </div>
                      </div>
                      {expandedCluster === cluster.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                    
                    {expandedCluster === cluster.id && (
                      <div className="mt-4 pl-14 space-y-4">
                        <div>
                          <h5 className="text-sm font-medium text-slate-600 mb-1">🧠 根因分析</h5>
                          <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                            {cluster.root_cause_summary || '暂无'}
                          </p>
                        </div>
                        
                        <div>
                          <h5 className="text-sm font-medium text-slate-600 mb-1">💡 行动建议</h5>
                          <p className="text-sm text-slate-700 bg-blue-50 p-3 rounded-lg">
                            {cluster.action_suggestion || '暂无'}
                          </p>
                        </div>
                        
                        {cluster.sample_reviews?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-slate-600 mb-1">📝 用户原声</h5>
                            <ul className="space-y-2">
                              {cluster.sample_reviews.slice(0, 3).map((quote, i) => (
                                <li key={i} className="text-sm text-slate-600 italic bg-slate-50 p-2 rounded border-l-2 border-slate-300">
                                  "{quote}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
