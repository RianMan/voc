import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { VOCItem } from '../types';
import { AlertTriangle, Bug, MessageCircle, TrendingUp } from 'lucide-react';

interface DashboardProps {
  data: VOCItem[];
}

// Map country codes to full names for better display
const COUNTRY_NAMES: Record<string, string> = {
  'PK': 'Pakistan',
  'MX': 'Mexico',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'TH': 'Thailand',
  'VN': 'Vietnam',
  'MY': 'Malaysia'
};

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  // Defensive check: ensure data is an array
  const safeData = Array.isArray(data) ? data : [];
  

  // Calculate Stats
  const total = safeData.length;
  const highRisk = safeData.filter(i => i.risk_level === 'High').length;
  const bugs = safeData.filter(i => i.category === 'Tech_Bug').length;
  const compliance = safeData.filter(i => i.category === 'Compliance_Risk').length;
  const product = safeData.filter(i => i.category === 'Product_Issue').length;
  const others = safeData.filter(i => ['Positive', 'User_Error', 'Other'].includes(i.category)).length;

  // Chart Data Preparation
  const categoryData = [
    { name: 'Compliance', value: compliance, color: '#ef4444' }, // Red
    { name: 'Tech Bugs', value: bugs, color: '#f59e0b' },       // Amber
    { name: 'Product', value: product, color: '#3b82f6' }, // Blue
    { name: 'Other', value: others, color: '#94a3b8' }, // Slate
  ];

  // Helper to safely get country count
  const getCountryCount = (code: string) => safeData.filter(i => i.country === code).length;

  // 【核心修改】动态生成国家数据
  // 1. 获取数据中出现过的所有国家代码 (去重)
  const presentCountries = Array.from(new Set(safeData.map(i => i.country).filter(Boolean)));
  
  // 2. 如果数据为空（刚加载时），使用默认列表占位
  const targetCountries = presentCountries.length > 0 
    ? presentCountries 
    : ['PK', 'MX', 'PH', 'ID', 'TH'];

  // 3. 生成图表数据
  const sourceData = targetCountries.map(code => ({
    name: COUNTRY_NAMES[code] || code, // 尝试显示全名，没有则显示代码
    code: code,
    users: getCountryCount(code)
  })).sort((a, b) => b.users - a.users); // 按数量从大到小排序

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        <p className={`text-xs mt-2 font-medium ${sub.includes('+') ? 'text-green-600' : 'text-slate-400'}`}>
          {sub}
        </p>
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
        <span className="text-sm text-slate-500">实时分析统计</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="总反馈" value={total} sub="已分析记录" icon={MessageCircle} color="bg-blue-500" />
        <StatCard title="高风险" value={highRisk} sub="需立即关注" icon={AlertTriangle} color="bg-red-500" />
        <StatCard title="合规问题" value={compliance} sub="威胁/骚扰关键词" icon={TrendingUp} color="bg-purple-500" />
        <StatCard title="技术Bug" value={bugs} sub="崩溃/OTP失败" icon={Bug} color="bg-amber-500" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">问题分类分布</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
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

        {/* Volume by Source */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">各国反馈量</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};