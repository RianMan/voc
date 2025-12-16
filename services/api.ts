import { FilterParams, PaginatedResponse, ReviewStatus, AppInfo, Report, GenerateReportResponse } from '../types';

const API_BASE = '/api';

// 获取存储的 token
function getToken(): string | null {
  return localStorage.getItem('voc_token');
}

// 带认证的 fetch
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { ...options, headers });
}

export async function fetchVocData(params: FilterParams): Promise<PaginatedResponse> {
  const query = new URLSearchParams();
  
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.risk && params.risk !== 'All') query.set('risk', params.risk);
  if (params.country && params.country !== 'All') query.set('country', params.country);
  if (params.search) query.set('search', params.search);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.status && params.status !== 'All') query.set('status', params.status);
  if (params.appId && params.appId !== 'All') query.set('appId', params.appId);
  if (params.reportMode) query.set('reportMode', 'true');

  const res = await authFetch(`${API_BASE}/voc-data?${query.toString()}`);
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
}

export async function updateReviewStatus(
  id: string, 
  status: ReviewStatus, 
  note?: string
): Promise<{ success: boolean; oldStatus: string; newStatus: string }> {
  const res = await authFetch(`${API_BASE}/voc/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('权限不足');
    throw new Error('Update failed');
  }
  return res.json();
}

export async function batchUpdateStatus(
  ids: string[], 
  status: ReviewStatus, 
  note?: string
): Promise<{ success: boolean; updated: number; updatedBy?: string }> {
  const res = await authFetch(`${API_BASE}/voc/batch-status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status, note })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('权限不足');
    throw new Error('Batch update failed');
  }
  return res.json();
}

export async function getStatusHistory(id: string): Promise<{
  success: boolean;
  data: Array<{
    id: number;
    review_id: string;
    old_status: string;
    new_status: string;
    user_id: number;
    user_name: string;
    note: string;
    created_at: string;
  }>;
}> {
  const res = await authFetch(`${API_BASE}/voc/${encodeURIComponent(id)}/history`);
  if (!res.ok) throw new Error('Get history failed');
  return res.json();
}

export async function getStatusStats(): Promise<Array<{ status: string; count: number }>> {
  const res = await fetch(`${API_BASE}/stats/status`);
  if (!res.ok) throw new Error('Get stats failed');
  return res.json();
}

// ========== 备注相关 ==========

export async function getNotes(reviewId: string): Promise<{
  success: boolean;
  data: Array<{
    id: number;
    review_id: string;
    user_id: number;
    user_name: string;
    content: string;
    created_at: string;
  }>;
}> {
  const res = await authFetch(`${API_BASE}/voc/${encodeURIComponent(reviewId)}/notes`);
  if (!res.ok) throw new Error('Get notes failed');
  return res.json();
}

export async function addNote(reviewId: string, content: string): Promise<{
  success: boolean;
  id: number;
  userName: string;
}> {
  const res = await authFetch(`${API_BASE}/voc/${encodeURIComponent(reviewId)}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('权限不足');
    throw new Error('Add note failed');
  }
  return res.json();
}

export async function getNotesCount(ids: string[]): Promise<{
  success: boolean;
  data: Record<string, number>;
}> {
  const res = await fetch(`${API_BASE}/voc/notes-count`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) throw new Error('Get notes count failed');
  return res.json();
}

// ========== 报告接口 ==========

export interface ReportFilters {
  category?: string;
  risk?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
}

export async function generateReport(filters: ReportFilters = {}, limit = 100): Promise<{
  success: boolean;
  report: string;
  meta: { totalAnalyzed: number; generatedAt: string };
}> {
  const res = await authFetch(`${API_BASE}/report/generate-qw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters, limit })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('仅管理员可生成报告');
    throw new Error('Report generation failed');
  }
  return res.json();
}

export async function fetchApps(): Promise<{ success: boolean; data: AppInfo[] }> {
  const res = await fetch(`${API_BASE}/apps`);
  if (!res.ok) throw new Error('Get apps failed');
  return res.json();
}

export async function generateAppReport(
  appId: string, 
  filters: ReportFilters = {}
): Promise<GenerateReportResponse> {
  const res = await authFetch(`${API_BASE}/report/generate-app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, filters, limit: 200 })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('仅管理员可生成报告');
    throw new Error('Report generation failed');
  }
  return res.json();
}

export async function generateAllReports(): Promise<{
  success: boolean;
  generated: number;
  failed: number;
  results: GenerateReportResponse[];
}> {
  const res = await authFetch(`${API_BASE}/report/generate-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('仅管理员可生成报告');
    throw new Error('Batch report generation failed');
  }
  return res.json();
}

export async function fetchReports(appId?: string, limit = 50): Promise<{ success: boolean; data: Report[] }> {
  const query = new URLSearchParams();
  if (appId) query.set('appId', appId);
  query.set('limit', String(limit));
  
  const res = await authFetch(`${API_BASE}/reports?${query.toString()}`);
  if (!res.ok) throw new Error('Get reports failed');
  return res.json();
}

export async function fetchReportDetail(id: number): Promise<{ success: boolean; data: Report }> {
  const res = await authFetch(`${API_BASE}/reports/${id}`);
  if (!res.ok) throw new Error('Get report detail failed');
  return res.json();
}


// services/api.ts 新增部分 - 追加到现有api.ts文件末尾

// ==================== 专题管理 API ====================

export interface TopicConfig {
  id: number;
  name: string;
  description?: string;
  keywords: string[];
  scope: 'global' | 'country' | 'app';
  country?: string;
  app_id?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface TopicAnalysis {
  id: number;
  topic_id: number;
  analysis_date: string;
  total_matches: number;
  sentiment_positive: number;
  sentiment_negative: number;
  sentiment_neutral: number;
  ai_summary: string;
  pain_points: string[];
  recommendations: string[];
}

export const fetchTopics = async (filters?: {
  scope?: string;
  country?: string;
  appId?: string;
  isActive?: boolean;
}) => {
  const params = new URLSearchParams();
  if (filters?.scope) params.append('scope', filters.scope);
  if (filters?.country) params.append('country', filters.country);
  if (filters?.appId) params.append('appId', filters.appId);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
  
  const res = await fetch(`${API_BASE}/topics?${params}`);
  return res.json();
};

export const createTopic = async (data: Partial<TopicConfig>) => {
  const res = await fetch(`${API_BASE}/topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateTopic = async (id: number, data: Partial<TopicConfig>) => {
  const res = await fetch(`${API_BASE}/topics/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteTopic = async (id: number) => {
  const res = await fetch(`${API_BASE}/topics/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const scanTopics = async (appId?: string, limit = 500) => {
  const res = await fetch(`${API_BASE}/topics/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ appId, limit })
  });
  return res.json();
};

export const analyzeTopic = async (topicId: number) => {
  const res = await fetch(`${API_BASE}/topics/${topicId}/analyze`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const fetchTopicHistory = async (topicId: number) => {
  const res = await fetch(`${API_BASE}/topics/${topicId}/history`);
  return res.json();
};

// ==================== 聚类分析 API ====================

export interface IssueCluster {
  id: number;
  app_id: string;
  category: string;
  week_number: number;
  year: number;
  cluster_title: string;
  cluster_rank: number;
  review_count: number;
  percentage: number;
  root_cause_summary: string;
  action_suggestion: string;
  sample_reviews: string[];
}

export const fetchClusters = async (filters?: {
  appId?: string;
  category?: string;
  weekNumber?: number;
  year?: number;
}) => {
  const params = new URLSearchParams();
  if (filters?.appId) params.append('appId', filters.appId);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.weekNumber) params.append('weekNumber', String(filters.weekNumber));
  if (filters?.year) params.append('year', String(filters.year));
  
  const res = await fetch(`${API_BASE}/clusters?${params}`);
  return res.json();
};

export const runClustering = async (appId: string, category: string, startDate?: string, endDate?: string) => {
  const res = await fetch(`${API_BASE}/clusters/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ appId, category, startDate, endDate })
  });
  return res.json();
};

export const runWeeklyClustering = async () => {
  const res = await fetch(`${API_BASE}/clusters/run-weekly`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const fetchClusterSummary = async (appId: string) => {
  const res = await fetch(`${API_BASE}/clusters/summary/${appId}`);
  return res.json();
};

// ==================== 闭环验证 API ====================

export interface VerificationConfig {
  id: number;
  app_id: string;
  issue_type: 'category' | 'cluster' | 'keyword';
  issue_value: string;
  baseline_start: string;
  baseline_end: string;
  verify_start: string;
  verify_end?: string;
  optimization_desc: string;
  expected_reduction?: number;
  status: 'monitoring' | 'resolved' | 'worsened' | 'no_change';
  created_at: string;
}

export interface VerificationResult {
  id: number;
  config_id: number;
  verify_date: string;
  baseline_count: number;
  baseline_total: number;
  verify_count: number;
  verify_total: number;
  change_percent: number;
  conclusion: string;
}

export const fetchVerifications = async (filters?: { appId?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (filters?.appId) params.append('appId', filters.appId);
  if (filters?.status) params.append('status', filters.status);
  
  const res = await fetch(`${API_BASE}/verifications?${params}`);
  return res.json();
};

export const createVerification = async (data: Partial<VerificationConfig>) => {
  const res = await fetch(`${API_BASE}/verifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const quickCreateVerification = async (data: {
  appId: string;
  issueType: string;
  issueValue: string;
  optimizationDate: string;
  optimizationDesc: string;
}) => {
  const res = await fetch(`${API_BASE}/verifications/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const runVerification = async (configId: number) => {
  const res = await fetch(`${API_BASE}/verifications/${configId}/run`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const runAllVerifications = async () => {
  const res = await fetch(`${API_BASE}/verifications/run-all`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const fetchVerificationHistory = async (configId: number) => {
  const res = await fetch(`${API_BASE}/verifications/${configId}/history`);
  return res.json();
};

export const fetchVerificationSummary = async (appId: string) => {
  const res = await fetch(`${API_BASE}/verifications/summary/${appId}`);
  return res.json();
};

// ==================== 增强周报 API ====================

export const generateWeeklyReport = async (appId: string) => {
  const res = await fetch(`${API_BASE}/weekly-report/generate/${appId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const generateAllWeeklyReports = async () => {
  const res = await fetch(`${API_BASE}/weekly-report/generate-all`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.json();
};

export const fetchStructuredReport = async (appId: string) => {
  const res = await fetch(`${API_BASE}/weekly-report/structured/${appId}`);
  return res.json();
};

// Helper
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('voc_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}