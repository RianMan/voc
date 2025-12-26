// services/modules/stats.ts
const API_BASE = '/api';

export const fetchVocStats = async (appId?: string, month?: string) => {
  const params = new URLSearchParams();
  if (appId && appId !== 'All') params.append('appId', appId);
  if (month) params.append('month', month);  // 👈 新增
  
  const res = await fetch(`${API_BASE}/stats?${params}`);
  return res.json();
};

export const fetchVocTrend = async (appId?: string, month?: string, weeks = 8) => {
  const params = new URLSearchParams();
  if (appId && appId !== 'All') params.append('appId', appId);
  if (month) params.append('month', month);  // 👈 新增
  params.append('weeks', String(weeks));
  
  const res = await fetch(`${API_BASE}/trend?${params}`);
  return res.json();
};