import React, { useState, useEffect } from 'react';
import { 
  fetchVerifications, createVerification, quickCreateVerification,
  runVerification, runAllVerifications, fetchVerificationHistory,
  fetchApps, VerificationConfig, VerificationResult, AppInfo, IssueCluster,fetchClusters
} from '../services/api';
import { 
  CheckCircle2, XCircle, Minus, TrendingDown, TrendingUp,
  Plus, Play, RefreshCw, Loader2, X, History, Target
} from 'lucide-react';
import { VerificationHistoryDrawer } from '../components/VerificationHistoryDrawer';
import {formatDate} from '../tools/index'

const STATUS_CONFIG = {
  monitoring: { label: '监控中', color: 'blue', icon: Target },
  resolved: { label: '已解决', color: 'green', icon: CheckCircle2 },
  improved: { label: '已改善', color: 'emerald', icon: TrendingDown },
  no_change: { label: '无变化', color: 'slate', icon: Minus },
  worsened: { label: '已恶化', color: 'red', icon: TrendingUp }
};

export const VerificationTracker: React.FC = () => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [verifications, setVerifications] = useState<VerificationConfig[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [clusters, setClusters] = useState<IssueCluster[]>([]);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  // const [showHistoryModal, setShowHistoryModal] = useState<{ config: VerificationConfig; history: VerificationResult[] } | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{
    open: boolean;
    config: VerificationConfig | null;
    history: VerificationResult[];
  }>({
    open: false,
    config: null,
    history: []
  });
  const [createMode, setCreateMode] = useState<'quick' | 'advanced'>('quick');
  
  // Form
  const [form, setForm] = useState({
    appId: '',
    issueType: 'category' as 'category' | 'cluster' | 'keyword',
    issueValue: '',
    optimizationDate: '',
    optimizationDesc: '',
    baselineStart: '',
    baselineEnd: '',
    verifyStart: '',
    expectedReduction: ''
  });

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (form.issueType === 'cluster' && form.appId) {
      fetchClusters({ appId: form.appId }).then(res => {
        setClusters(res.data || []);
      });
    }
  }, [form.appId, form.issueType]);

  useEffect(() => {
    loadVerifications();
  }, [selectedApp, statusFilter]);

  const loadApps = async () => {
    const res = await fetchApps();
    setApps(res.data || []);
  };

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const res = await fetchVerifications({
        appId: selectedApp || undefined,
        status: statusFilter || undefined
      });
      setVerifications(res.data || []);
    } catch (e) {
      console.error('Load failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (createMode === 'quick') {
        await quickCreateVerification({
          appId: form.appId,
          issueType: form.issueType,
          issueValue: form.issueValue,
          optimizationDate: form.optimizationDate,
          optimizationDesc: form.optimizationDesc
        });
      } else {
        await createVerification({
          app_id: form.appId,
          issue_type: form.issueType,
          issue_value: form.issueValue,
          baseline_start: form.baselineStart,
          baseline_end: form.baselineEnd,
          verify_start: form.verifyStart,
          verify_end: null,
          optimization_desc: form.optimizationDesc,
          expected_reduction: form.expectedReduction ? parseFloat(form.expectedReduction) : undefined
        });
      }
      setShowCreateModal(false);
      loadVerifications();
      resetForm();
    } catch (e) {
      alert('创建失败');
    }
  };

  const resetForm = () => {
    setForm({
      appId: '', issueType: 'category', issueValue: '',
      optimizationDate: '', optimizationDesc: '',
      baselineStart: '', baselineEnd: '', verifyStart: '', expectedReduction: ''
    });
  };

  const handleRun = async (configId: number) => {
    setRunning(configId);
    try {
      const result = await runVerification(configId);
      alert(`验证完成！结论: ${result.conclusionText}`);
      loadVerifications();
    } catch (e) {
      alert('验证失败');
    } finally {
      setRunning(null);
    }
  };

  const handleRunAll = async () => {
    if (!confirm('确定执行所有监控中的验证？')) return;
    setRunningAll(true);
    try {
      const result = await runAllVerifications();
      alert(`批量验证完成！已解决 ${result.summary.resolved}，改善 ${result.summary.improved}，恶化 ${result.summary.worsened}`);
      loadVerifications();
    } catch (e) {
      alert('执行失败');
    } finally {
      setRunningAll(false);
    }
  };

  const handleViewHistory = async (config: VerificationConfig) => {
    const res = await fetchVerificationHistory(config.id);
    setHistoryDrawer({
      open: true,
      config,
      history: res.data || []
    });
  };


  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.monitoring;
  };

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">闭环效果验证</h2>
          <p className="text-sm text-slate-500">追踪优化措施是否真正解决问题</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunAll}
            disabled={runningAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
          >
            {runningAll ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            批量验证
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus size={18} /> 新建验证
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4">
        <select
          value={selectedApp}
          onChange={(e) => setSelectedApp(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">所有App</option>
          {apps.map(app => (
            <option key={app.appId} value={app.appId}>{app.appName}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">所有状态</option>
          <option value="monitoring">监控中</option>
          <option value="resolved">已解决</option>
          <option value="worsened">已恶化</option>
        </select>
      </div>

      {/* Verification List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : verifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Target size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">暂无验证配置</p>
          <p className="text-sm text-slate-400 mt-2">创建验证来追踪优化效果</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">问题类型</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">目标</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">优化措施</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">状态</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">时间</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {verifications.map(v => {
                const statusCfg = getStatusConfig(v.status);
                const StatusIcon = statusCfg.icon;
                
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium
                        ${v.issue_type === 'category' ? 'bg-blue-50 text-blue-700' :
                          v.issue_type === 'keyword' ? 'bg-purple-50 text-purple-700' :
                          'bg-green-50 text-green-700'}`}
                      >
                        {v.issue_type === 'category' ? '分类' : 
                         v.issue_type === 'keyword' ? '关键词' : '聚类'}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800">{v.issue_value}</td>
                    <td className="px-4 py-4 text-slate-600 max-w-xs truncate" title={v.optimization_desc}>
                      {v.optimization_desc || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                        bg-${statusCfg.color}-50 text-${statusCfg.color}-700`}
                      >
                        <StatusIcon size={12} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      <div>基准: {formatDate(v.baseline_start)} ~ {formatDate(v.baseline_end)}</div>
                      <div>验证: {formatDate(v.verify_start)} ~</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleViewHistory(v)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                          title="查看历史"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => handleRun(v.id)}
                          disabled={running === v.id}
                          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                          title="执行验证"
                        >
                          {running === v.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">新建验证</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setCreateMode('quick')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                  ${createMode === 'quick' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
              >
                快速创建
              </button>
              <button
                onClick={() => setCreateMode('advanced')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                  ${createMode === 'advanced' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}
              >
                高级配置
              </button>
            </div>

            <div className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">问题类型</label>
                  <select
                    value={form.issueType}
                    onChange={(e) => setForm({ ...form, issueType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  >
                    <option value="category">分类</option>
                    <option value="keyword">关键词</option>
                    <option value="cluster">聚类ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">目标值</label>
                  {form.issueType === 'cluster' ? (
                    <select
                      value={form.issueValue}
                      onChange={(e) => setForm({ ...form, issueValue: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    >
                      <option value="">选择聚类</option>
                      {clusters.map(cluster => (
                        <option key={cluster.id} value={cluster.id}>
                          #{cluster.id} - {cluster.cluster_title} ({cluster.category}, {cluster.review_count}条)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.issueValue}
                      onChange={(e) => setForm({ ...form, issueValue: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      placeholder={form.issueType === 'category' ? 'Tech_Bug' : '短信验证码'}
                    />
                  )}
                </div>
              </div>

              {createMode === 'quick' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">优化上线日期</label>
                  <input
                    type="date"
                    value={form.optimizationDate}
                    onChange={(e) => setForm({ ...form, optimizationDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <p className="text-xs text-slate-400 mt-1">系统将自动以上线前14天作为基准期</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">基准期开始</label>
                      <input
                        type="date"
                        value={form.baselineStart}
                        onChange={(e) => setForm({ ...form, baselineStart: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">基准期结束</label>
                      <input
                        type="date"
                        value={form.baselineEnd}
                        onChange={(e) => setForm({ ...form, baselineEnd: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">验证期开始</label>
                    <input
                      type="date"
                      value={form.verifyStart}
                      onChange={(e) => setForm({ ...form, verifyStart: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">优化措施描述</label>
                <textarea
                  value={form.optimizationDesc}
                  onChange={(e) => setForm({ ...form, optimizationDesc: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  rows={2}
                  placeholder="如：修复了短信发送延迟问题"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      <VerificationHistoryDrawer
        open={historyDrawer.open}
        config={historyDrawer.config}
        history={historyDrawer.history}
        onClose={() =>
          setHistoryDrawer({ open: false, config: null, history: [] })
        }
        getConclusionText={(r) => getStatusConfig(r.conclusion).label}
      />
    </div>
  );
};
