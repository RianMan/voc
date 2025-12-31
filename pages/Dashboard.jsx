import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { fetchTrendAnalysis, fetchSentimentStats } from '../services/api';
import { Loader2, TrendingUp, BarChart3, PieChart as PieIcon } from 'lucide-react';
import { Select, Radio } from 'antd';

export const Dashboard = () => {
  const [apps] = useState([
    { appId: 'com.mexicash.app', appName: 'MexiCash', country: 'MX' }
  ]);
  const [selectedApp, setSelectedApp] = useState('com.mexicash.app');
  
  // 筛选状态
  const [period, setPeriod] = useState('week'); // 'day', 'week', 'month'
  const [sentiment, setSentiment] = useState('Positive'); // 'Positive', 'Neutral', 'Negative'
  
  // 数据状态
  const [chartData, setChartData] = useState([]);
  const [sentimentData, setSentimentData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      loadAnalysisData();
    }
  }, [selectedApp, period, sentiment]); // 监听变化

  const loadAnalysisData = async () => {
    setLoading(true);
    // 动态计算 limit
    const limit = period === 'day' ? 14 : (period === 'month' ? 12 : 8);
    
    try {
      const [trendRes, sentimentRes] = await Promise.all([
        // 折线图接口
        fetchTrendAnalysis({ appId: selectedApp, period, sentiment, limit }),
        // ✅ 柱状图接口 (现在也传 limit 了，实现时间联动)
        fetchSentimentStats({ appId: selectedApp, period, limit }) 
      ]);

      if (trendRes.success) {
        // 格式化数据，确保是数字
        const formatted = trendRes.data.map(item => ({
          ...item,
          total_count: Number(item.total_count),
          google_count: Number(item.google_count),
          udesk_count: Number(item.udesk_count)
        }));
        setChartData(formatted);
      }

      if (sentimentRes.success) {
        setSentimentData(sentimentRes.data);
      }
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  };

  // 左下角：来源分布 (根据折线图数据计算)
  const totalSummary = chartData.reduce((acc, curr) => ({
    google: acc.google + curr.google_count,
    udesk: acc.udesk + curr.udesk_count,
    total: acc.total + curr.total_count
  }), { google: 0, udesk: 0, total: 0 });

  const sourceData = [
    { name: 'Google Play', value: totalSummary.google, color: '#10b981' },
    { name: 'Udesk', value: totalSummary.udesk, color: '#3b82f6' }
  ];

  const SENTIMENT_COLORS = {
    '好评': '#10b981',
    '中评': '#94a3b8',
    '差评': '#ef4444'
  };
  
  const getCurrentTrendColor = () => {
    if (sentiment === 'Positive') return '#10b981';
    if (sentiment === 'Negative') return '#ef4444';
    return '#94a3b8';
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
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">时间:</span>
            <Radio.Group value={period} onChange={e => setPeriod(e.target.value)} size="small" buttonStyle="solid">
              <Radio.Button value="day">日</Radio.Button>
              <Radio.Button value="week">周</Radio.Button>
              <Radio.Button value="month">月</Radio.Button>
            </Radio.Group>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">折线图指标:</span>
            <Radio.Group value={sentiment} onChange={e => setSentiment(e.target.value)} size="small" buttonStyle="solid">
              <Radio.Button value="Positive">好评</Radio.Button>
              <Radio.Button value="Neutral">中评</Radio.Button>
              <Radio.Button value="Negative">差评</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* 1. 趋势折线图 */}
          <div className="xl:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: '#1e293b' }}>
              <TrendingUp size={20} style={{ color: getCurrentTrendColor() }} />
              <span className="mr-2">
                {sentiment === 'Positive' ? '好评' : sentiment === 'Negative' ? '差评' : '中评'}趋势
              </span>
              <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">
                (Google Play & Udesk)
              </span>
            </h3>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {/* ✅ 关键：加 key 强制刷新，解决“切换无效果”的视觉问题 */}
                <LineChart 
                  key={period + sentiment} 
                  data={chartData} 
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date_key" tick={{ fontSize: 12 }} tickMargin={10} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="total_count" name="总量" stroke={getCurrentTrendColor()} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="google_count" name="Google Play" stroke="#10b981" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="udesk_count" name="Udesk" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. 来源分布 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              来源分布 
              <span className="text-xs font-normal text-slate-400 ml-2">({period === 'day' ? '近14天' : period === 'month' ? '近1年' : '近8周'})</span>
            </h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart key={period} data={sourceData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. 情感分布对比 (✅ 现在支持时间切换了) */}
          <div className="xl:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PieIcon size={20} className="text-slate-500" />
              情感分布对比 
              <span className="text-xs font-normal text-slate-400">
                ({period === 'day' ? '近14天' : period === 'month' ? '近1年' : '近8周'})
              </span>
            </h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart key={period} data={sentimentData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={40} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30} label={{ position: 'right' }}>
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};