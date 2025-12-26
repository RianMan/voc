// services/modules/reports.ts
import { AppInfo, Report, GenerateReportResponse } from '../../types';
import { authFetch } from './auth';

const API_BASE = '/api';

export interface ReportFilters {
  category?: string;
  risk?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
}

// ========== Apps ==========
export async function fetchApps(): Promise<{ success: boolean; data: AppInfo[] }> {
  const res = await fetch(`${API_BASE}/apps`);
  if (!res.ok) throw new Error('Get apps failed');
  return res.json();
}

// ========== 月度报告（保留，可能还在用） ==========
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

// ========== 报告列表 ==========
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

// ========== 周报（新增） ==========
export async function generateWeeklyReport(appId: string, weekOffset = 0): Promise<{
  success: boolean;
  report: string;
  meta: {
    appId: string;
    appName: string;
    weekNumber: number;
    year: number;
    dateRange: string;
    totalAnalyzed: number;
    clustersFound: number;
  };
}> {
  const res = await authFetch(`${API_BASE}/weekly-report/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, weekOffset })
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录');
    throw new Error('Weekly report generation failed');
  }
  return res.json();
}