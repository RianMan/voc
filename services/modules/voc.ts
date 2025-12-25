// services/modules/voc.ts
import { FilterParams, PaginatedResponse, ReviewStatus } from '../../types';
import { authFetch } from './auth';

const API_BASE = '/api';

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
   if (params.source && params.source !== 'All') query.set('source', params.source);
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