// services/modules/clusters.ts
import { getAuthHeaders } from './auth';

const API_BASE = '/api';

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

export const fetchClusterSummary = async (appId: string, month?: string) => {
  const params = new URLSearchParams();
  if (month) params.append('month', month);
  
  const res = await fetch(`${API_BASE}/clusters/summary/${appId}?${params}`);
  return res.json();
};