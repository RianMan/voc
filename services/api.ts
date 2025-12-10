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
