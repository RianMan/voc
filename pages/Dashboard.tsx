import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { VOCItem, AppInfo } from '../types';
import { 
  AlertTriangle, Bug, MessageCircle, TrendingUp, TrendingDown, 
  Layers, Target, Tag, FileText, Loader2
} from 'lucide-react';
import { fetchClusterSummary, fetchVerificationSummary, fetchTopics } from '../services/api';

interface DashboardProps {
  data: VOCItem[];
}

const COUNTRY_NAMES: Record<string, string> = {
  'PK': 'Pakistan', 'MX': 'Mexico', 'PH': 'Philippines',
  'ID': 'Indonesia', 'TH': 'Thailand', 'VN': 'Vietnam', 'MY': 'Malaysia'
};

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const safeData = Array.isArray(data) ? data : [];
  
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [clusterSummary, setClusterSummary] = useState<any>(null);
  const [verificationSummary, setVerificationSummary] = useState<any[]>([]);
  const [topicCount, setTopicCount] = useState<number>(0);
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);

  // 获取所有App
  const apps = Array.from(new Set(safeData.map(d => d.appId).filter(Boolean)));
  
  useEffect(() => {
    if (apps.length > 0 && !selectedApp) {
      setSelectedApp(apps[0]);
    }
  }, [apps]);

  useEffect(() => {
    if (selectedApp) {
      loadAdvancedData();
    }
  }, [selectedApp]);

  const loadAdvancedData = async () => {
    setLoadingAdvanced(true);
    try {
      const [clusterRes, verifyRes, topicRes] = await Promise.all([
        fetchClusterSummary(selectedApp).catch(() => ({ data: null })),
        fetchVerificationSummary(selectedApp).catch(() => ({ data: [] })),
        fetchTopics({ appId: selectedApp, isActive: true }).catch(() => ({ data: [] }))
      ]);
      setClusterSummary(clusterRes.data);
      setVerificationSummary(verifyRes.data || []);
      setTopicCount(topicRes.data?.length || 0);
    } catch (e) {
      console.error('Load advanced data failed', e);
    } finally {
      setLoadingAdvanced(false);
    }
  };

  // 基础统计
  const total = safeData.length;
  const highRisk = safeData.filter(i => i.risk_level === 'High').length;
  const bugs = safeData.filter(i => i.category === 'Tech_Bug').length;
  const compliance = safeData.filter(i => i.category === 'Compliance_Risk').length;
  const product = safeData.filter(i => i.category === 'Product_Issue').length;
  const others = safeData.filter(i => ['Positive', 'User_Error', 'Other'].includes(i.category)).length;

  const categoryData = [
    { name: 'Compliance', value: compliance, color: '#ef4444' },
    { name: 'Tech Bugs', value: bugs, color: '#f59e0b' },
    { name: 'Product', value: product, color: '#3b82f6' },
    { name: 'Other', value: others, color: '#94a3b8' },
  ];

  const presentCountries = Array.from(new Set(safeData.map(i => i.country).filter(Boolean)));
  const targetCountries = presentCountries.length > 0 ? presentCountries : ['PK', 'MX', 'PH', 'ID', 'TH'];
  const getCountryCount = (code: string) => safeData.filter(i => i.country === code).length;
  const sourceData = targetCountries.map(code => ({
    name: COUNTRY_NAMES[code] || code,
    users: getCountryCount(code)
  })).sort((a, b) => b.users - a.users);

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        <p className={`text-xs mt-2 font-medium ${sub.includes('+') ? 'text-green-600' : 'text-slate-400'}`}>{sub}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">概览</h2>
        <div className="flex items-center gap-4">
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            {apps.map(appId => (
              <option key={appId} value={appId}>
                {safeData.find(d => d.appId === appId)?.appName || appId}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500">实时分析统计</span>
        </div>
      </div>

      {/* Basic Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="总反馈" value={total} sub="已分析记录" icon={MessageCircle} color="bg-blue-500" />
        <StatCard title="高风险" value={highRisk} sub="需立即关注" icon={AlertTriangle} color="bg-red-500" />
        <StatCard title="合规问题" value={compliance} sub="威胁/骚扰关键词" icon={TrendingUp} color="bg-purple-500" />
        <StatCard title="技术Bug" value={bugs} sub="崩溃/OTP失败" icon={Bug} color="bg-amber-500" />
      </div>

      {/* Advanced Features Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cluster Summary */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={20} className="text-blue-500" />
            <h3 className="text-lg font-semibold text-slate-800">本周 Top 痛点</h3>
          </div>
          {loadingAdvanced ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-300" size={24} />
            </div>
          ) : clusterSummary?.byCategory ? (
            <div className="space-y-3">
              {Object.entries(clusterSummary.byCategory).slice(0, 2).map(([cat, clusters]: [string, any]) => (
                <div key={cat}>
                  <p className="text-xs text-slate-500 mb-1">{cat}</p>
                  {(clusters as any[]).slice(0, 2).map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center
                        ${c.rank === 1 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {c.rank}
                      </span>
                      <span className="text-sm text-slate-700 flex-1 truncate">{c.title}</span>
                      <span className="text-xs text-slate-400">{c.count}条</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">暂无聚类数据</p>
          )}
        </div>

        {/* Verification Summary */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Target size={20} className="text-green-500" />
            <h3 className="text-lg font-semibold text-slate-800">闭环验证</h3>
          </div>
          {loadingAdvanced ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-300" size={24} />
            </div>
          ) : verificationSummary.length > 0 ? (
            <div className="space-y-2">
              {verificationSummary.slice(0, 4).map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700 truncate flex-1">{v.issueValue}</span>
                  <span className={`text-xs px-2 py-0.5 rounded
                    ${v.status === 'resolved' ? 'bg-green-50 text-green-700' :
                      v.status === 'worsened' ? 'bg-red-50 text-red-700' :
                      'bg-blue-50 text-blue-700'}`}>
                    {v.conclusionText || v.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">暂无验证配置</p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={20} className="text-purple-500" />
            <h3 className="text-lg font-semibold text-slate-800">监控配置</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{topicCount}</p>
              <p className="text-xs text-purple-600">活跃专题</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{verificationSummary.length}</p>
              <p className="text-xs text-green-600">验证追踪</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {verificationSummary.filter((v: any) => v.status === 'resolved').length}
              </p>
              <p className="text-xs text-blue-600">已验证解决</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {verificationSummary.filter((v: any) => v.status === 'worsened').length}
              </p>
              <p className="text-xs text-red-600">需关注恶化</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">问题分类分布</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            {categoryData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">各国反馈量</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
