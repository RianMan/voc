// 文件：pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { fetchTrendAnalysis } from '../services/api';
import { Loader2, TrendingUp, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { Select, Radio } from 'antd';

export const Dashboard = () => {
  const [apps] = useState([
    { appId: 'com.mexicash.app', appName: 'MexiCash', country: 'MX' }
  ]);
  const [selectedApp, setSelectedApp] = useState('com.mexicash.app');
  
  // 筛选状态 (去掉了 sentiment 筛选，因为现在是看整体比率)
  const [period, setPeriod] = useState('week'); // 'day', 'week', 'month'
  
  // 数据状态
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      loadAnalysisData();
    }
  }, [selectedApp, period]);

  const loadAnalysisData = async () => {
    setLoading(true);
    // 动态计算 limit
    const limit = period === 'day' ? 14 : (period === 'month' ? 12 : 8);
    
    try {
      // ✅ 只需要调用这一个接口，数据就全有了
      const trendRes = await fetchTrendAnalysis({ appId: selectedApp, period, limit });

      if (trendRes.success) {
        // 格式化数据，并计算好评率/差评率
        const formatted = trendRes.data.map(item => {
          const total = Number(item.total_count) || 1; // 防止除以0
          const pos = Number(item.positive_count) || 0;
          const neg = Number(item.negative_count) || 0;
          const neu = Number(item.neutral_count) || 0;
          
          return {
            ...item,
            date_key: item.date_key,
            total_count: total,
            positive_count: pos,
            negative_count: neg,
            neutral_count: neu,
            // ✅ 计算比率 (保留1位小数)
            positive_rate: ((pos / total) * 100).toFixed(1),
            negative_rate: ((neg / total) * 100).toFixed(1)
          };
        });
        setChartData(formatted);
      }
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 筛选栏 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-lg">
            <BarChart3 className="text-blue-600" />
            <span>数据概览</span>
          </div>
          <Select
            value={selectedApp}
            onChange={setSelectedApp}
            style={{ width: 200 }}
            options={apps.map(app => ({ label: app.appName, value: app.appId }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">时间维度:</span>
          <Radio.Group value={period} onChange={e => setPeriod(e.target.value)} size="small" buttonStyle="solid">
            <Radio.Button value="day">日</Radio.Button>
            <Radio.Button value="week">周</Radio.Button>
            <Radio.Button value="month">月</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* 1. 好评率/差评率趋势 (折线图) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
              <TrendingUp size={20} className="text-blue-600" />
              <span>口碑趋势分析 (好评率 vs 差评率)</span>
            </h3>
            
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData} 
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date_key" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
                  <YAxis 
                    unit="%" 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    domain={[0, 100]} // Y轴固定 0-100%
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value) => [`${value}%`]}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  
                  {/* 好评率 - 绿色 */}
                  <Line 
                    type="monotone" 
                    dataKey="positive_rate" 
                    name="好评率" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 2 }} 
                    activeDot={{ r: 6 }} 
                  />
                  
                  {/* 差评率 - 红色 */}
                  <Line 
                    type="monotone" 
                    dataKey="negative_rate" 
                    name="差评率" 
                    stroke="#ef4444" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 2 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. 情感分布堆积图 (柱状图) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieIcon size={20} className="text-purple-600" />
              <span>情感分布走势</span>
              <span className="text-xs font-normal text-slate-400">
                (总量堆积)
              </span>
            </h3>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date_key" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  
                  {/* 堆积柱状图 stackId 必须相同 */}
                  <Bar dataKey="negative_count" name="差评数" stackId="a" fill="#ef4444" barSize={40} />
                  <Bar dataKey="neutral_count" name="中评数" stackId="a" fill="#94a3b8" barSize={40} />
                  <Bar dataKey="positive_count" name="好评数" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};