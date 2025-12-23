// services/modules/stats.ts
const API_BASE = '/api';

export const fetchVocStats = async (appId?: string) => {
  const params = new URLSearchParams();
  if (appId && appId !== 'All') params.append('appId', appId);
  
  const res = await fetch(`${API_BASE}/stats?${params}`);
  return res.json();
};

export const fetchVocTrend = async (appId?: string, weeks = 8) => {
  const params = new URLSearchParams();
  if (appId && appId !== 'All') params.append('appId', appId);
  params.append('weeks', String(weeks));
  
  const res = await fetch(`${API_BASE}/trend?${params}`);
  return res.json();
};