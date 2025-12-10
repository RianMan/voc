import { FilterParams, PaginatedResponse, ReviewStatus, AppInfo, Report, GenerateReportResponse } from '../types';

const API_BASE = '/api';

export async function fetchVocData(params: FilterParams): Promise<PaginatedResponse> {
  const query = new URLSearchParams();
  
  query.set('page', String(params.page));
  query.set('limit', String(params.limit));
  if (params.reportMode) query.set('reportMode', 'true');
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.risk && params.risk !== 'All') query.set('risk', params.risk);
  if (params.country && params.country !== 'All') query.set('country', params.country);
  if (params.search) query.set('search', params.search);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.status && params.status !== 'All') query.set('status', params.status);
  if (params.appId && params.appId !== 'All') query.set('appId', params.appId);
  const res = await fetch(`${API_BASE}/voc-data?${query.toString()}`);
  if (!res.ok) throw new Error('Fetch failed');
  return res.json();
}

export async function updateReviewStatus(
  id: string, 
  status: ReviewStatus, 
  note?: string
): Promise<{ success: boolean; oldStatus: string; newStatus: string }> {
  const res = await fetch(`${API_BASE}/voc/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note })
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export async function batchUpdateStatus(
  ids: string[], 
  status: ReviewStatus, 
  note?: string
): Promise<{ success: boolean; updated: number }> {
  const res = await fetch(`${API_BASE}/voc/batch-status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status, note })
  });
  if (!res.ok) throw new Error('Batch update failed');
  return res.json();
}

export async function getStatusHistory(id: string): Promise<Array<{
  id: number;
  review_id: string;
  old_status: string;
  new_status: string;
  operator: string;
  note: string;
  created_at: string;
}>> {
  const res = await fetch(`${API_BASE}/voc/${encodeURIComponent(id)}/history`);
  if (!res.ok) throw new Error('Get history failed');
  return res.json();
}

export async function getStatusStats(): Promise<Array<{ status: string; count: number }>> {
  const res = await fetch(`${API_BASE}/stats/status`);
  if (!res.ok) throw new Error('Get stats failed');
  return res.json();
}

// ========== 旧版报告接口（兼容） ==========

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
  const res = await fetch(`${API_BASE}/report/generate-qw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters, limit })
  });
  if (!res.ok) throw new Error('Report generation failed');
  return res.json();
}

// ========== 新版报告接口 ==========

/**
 * 获取所有App列表
 */
export async function fetchApps(): Promise<{ success: boolean; data: AppInfo[] }> {
  const res = await fetch(`${API_BASE}/apps`);
  if (!res.ok) throw new Error('Get apps failed');
  return res.json();
}

/**
 * 为指定App生成报告
 */
export async function generateAppReport(
  appId: string, 
  filters: ReportFilters = {}
): Promise<GenerateReportResponse> {
  const res = await fetch(`${API_BASE}/report/generate-app`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, filters, limit: 200 })
  });
  if (!res.ok) throw new Error('Report generation failed');
  return res.json();
}

/**
 * 为所有App批量生成报告
 */
export async function generateAllReports(): Promise<{
  success: boolean;
  generated: number;
  failed: number;
  results: GenerateReportResponse[];
}> {
  const res = await fetch(`${API_BASE}/report/generate-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Batch report generation failed');
  return res.json();
}

/**
 * 获取报告存档列表
 */
export async function fetchReports(appId?: string, limit = 50): Promise<{ success: boolean; data: Report[] }> {
  const query = new URLSearchParams();
  if (appId) query.set('appId', appId);
  query.set('limit', String(limit));
  
  const res = await fetch(`${API_BASE}/reports?${query.toString()}`);
  if (!res.ok) throw new Error('Get reports failed');
  return res.json();
}

/**
 * 获取单个报告详情
 */
export async function fetchReportDetail(id: number): Promise<{ success: boolean; data: Report }> {
  const res = await fetch(`${API_BASE}/reports/${id}`);
  if (!res.ok) throw new Error('Get report detail failed');
  return res.json();
}
