import React, { useEffect, useState } from 'react';
import { 
  Coins, TrendingUp, FileText, Search, Loader2, DollarSign, BarChart3 
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface CostStats {
  total: number;
  weekly: number;
  breakdown: {
    operation_type: string;
    cost: number;
    tokens: number;
  }[];
}

export const CostOverview: React.FC = () => {
  const [stats, setStats] = useState<CostStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/costs')
      .then(res => res.json())
      .then(res => {
        console.log(res,'rere');
        if (res.success) setStats(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!stats) return <div className="p-8 text-center text-slate-500">暂无费用数据</div>;

  // 数据处理
  const reportCost = stats.breakdown.find(b => b.operation_type === 'report');
  const analysisCost = stats.breakdown.find(b => b.operation_type === 'analysis');

  const chartData = [
    { name: '评论分析 (DeepSeek)', value: analysisCost?.cost || 0, color: '#3b82f6' },
    { name: '周报生成 (Qwen/DeepSeek)', value: reportCost?.cost || 0, color: '#8b5cf6' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">AI 费用统计</h2>
        <p className="text-sm text-slate-500">监控 DeepSeek 与 通义千问 API 调用成本</p>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 总投入 */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Coins className="text-white" size={24} />
            </div>
            <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded">累计</span>
          </div>
          <p className="text-indigo-100 text-sm mb-1">项目总投入</p>
          <h3 className="text-3xl font-bold">¥ {stats.total.toFixed(4)}</h3>
        </div>

        {/* 本周投入 */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded">本周</span>
          </div>
          <p className="text-slate-500 text-sm mb-1">本周新增费用</p>
          <h3 className="text-3xl font-bold text-slate-800">¥ {stats.weekly.toFixed(4)}</h3>
        </div>

        {/* 预算估算 */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <DollarSign className="text-amber-600" size={24} />
            </div>
             <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded">预估</span>
          </div>
          <p className="text-slate-500 text-sm mb-1">单份周报平均成本</p>
          {/* 这里简单用 总报告费用 / 10 (假设值) 或者直接展示最近一次的 */}
          <h3 className="text-3xl font-bold text-slate-800">
            ¥ {reportCost ? (reportCost.cost / Math.max(1, (reportCost.tokens / 3000))).toFixed(3) : '0.000'}
            <span className="text-xs text-slate-400 font-normal ml-2">/份 (估算)</span>
          </h3>
        </div>
      </div>

      {/* 详细图表与数据 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 费用构成图表 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-slate-500" />
            成本构成分析
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" unit="元" />
                <YAxis dataKey="name" type="category" width={140} tick={{fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  formatter={(value: number) => [`¥ ${value.toFixed(4)}`, '费用']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                   {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 详细数据列表 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <FileText size={20} className="text-slate-500" />
            详情列表
          </h3>
          
          <div className="space-y-4">
            {/* 评论分析详情 */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded">
                    <Search size={16} className="text-blue-600" />
                  </div>
                  <span className="font-medium text-slate-700">评论清洗与分析</span>
                </div>
                <span className="text-lg font-bold text-blue-600">¥ {analysisCost?.cost.toFixed(4) || 0}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>模型: DeepSeek Chat</span>
                <span>Token消耗: {((analysisCost?.tokens || 0) / 1000).toFixed(1)}k</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">包含: 情感分析、风险识别、翻译、去重</p>
            </div>

            {/* 周报生成详情 */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded">
                    <FileText size={16} className="text-purple-600" />
                  </div>
                  <span className="font-medium text-slate-700">周报生成</span>
                </div>
                <span className="text-lg font-bold text-purple-600">¥ {reportCost?.cost.toFixed(4) || 0}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>模型: Qwen3-Max / DeepSeek</span>
                <span>Token消耗: {((reportCost?.tokens || 0) / 1000).toFixed(1)}k</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">包含: 多维度统计、行动建议生成、Markdown排版</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};