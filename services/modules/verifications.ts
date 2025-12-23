// services/modules/verifications.ts
import { getAuthHeaders } from './auth';

const API_BASE = '/api';

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
  baseline_ratio: number;
  verify_ratio: number;
  summary: string;
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