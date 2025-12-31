// src/services/api.js

export const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('voc_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
  
  // 处理 401 未登录
  if (res.status === 401) {
    localStorage.removeItem('voc_token');
    window.location.href = '/login';
    return { success: false, error: 'Unauthorized' };
  }
  
  try {
    return await res.json();
  } catch (e) {
    return { success: false, error: 'Parse Error' };
  }
}


// === Dashboard 概览 ===
export const fetchTrendAnalysis = ({ appId, period, sentiment, limit }) => {
  const params = new URLSearchParams({ 
    appId, 
    period, 
    sentiment, 
    limit: String(limit) 
  });
  return request(`/voc/trend-analysis?${params}`);
};

// === 1. 反馈提炼 (Monthly Insights) ===
export const fetchMonthlyInsights = (appId, month) => 
  request(`/insights/monthly?appId=${appId}&month=${month}`);

export const generateMonthlyInsights = (appId, month) => 
  request('/insights/generate', {
    method: 'POST',
    body: JSON.stringify({ appId, month })
  });

export const markInsight = (id, isMarked, type = 'insight') => 
  request(`/insights/${id}/mark`, {
    method: 'PUT',
    body: JSON.stringify({ isMarked, type })
  });

// === 2. 专题趋势 (Topic Trends) ===
export const fetchTopicTrends = (appId, month) => 
  request(`/insights/topics?appId=${appId}&month=${month}`);

// 生成专题趋势
export const generateTopicTrends = (appId, month) => 
  request('/insights/topics/generate', {
    method: 'POST',
    body: JSON.stringify({ appId, month })
  });

// === 3. 事项追踪 (Tasks) ===
export const createTask = (taskData) => 
  request('/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData)
  });

  // 【新增】更新事项
export const updateTask = (id, data) => 
  request(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
});

export const fetchTasks = (status) => 
  request(`/tasks${status ? `?status=${status}` : ''}`);


export const fetchSentimentStats = ({ appId, period, limit }) => 
  request(`/voc/sentiment-stats?appId=${appId}&period=${period}&limit=${limit}`);

// === 4. 专题管理 (Topic Configs) ===
export const fetchTopicConfigs = () => request('/topics');
export const createTopicConfig = (data) => request('/topics', { method: 'POST', body: JSON.stringify(data) });
export const deleteTopicConfig = (id) => request(`/topics/${id}`, { method: 'DELETE' });

// === 5. 用户管理 (User Management) ===
export const fetchUsers = () => request('/users');

export const createUser = (data) => 
  request('/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const updateUser = (id, data) => 
  request(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

export const deleteUser = (id) => 
  request(`/users/${id}`, {
    method: 'DELETE'
});

// === 6. 系统维护 (Admin System) ===
export const triggerAnalyze = (targetAppId) => 
  request('/admin/trigger/analyze', { 
    method: 'POST',
    body: JSON.stringify({ targetAppId }) 
  });

export const triggerFetchGP = (days = 7, targetAppId) => 
  request('/admin/trigger/fetch-gp', { 
    method: 'POST', 
    body: JSON.stringify({ days, targetAppId }) 
  });

export const triggerFetchUdesk = (days = 7, targetAppId) => 
  request('/admin/trigger/fetch-udesk', { 
    method: 'POST', 
    body: JSON.stringify({ days, targetAppId }) 
  });

  // === 7. 应用管理 (App Manager) ===
export const fetchApps = () => request('/apps'); // 复用

export const createApp = (data) => 
  request('/apps', { method: 'POST', body: JSON.stringify(data) });

export const deleteApp = (id) => 
  request(`/apps/${id}`, { method: 'DELETE' });