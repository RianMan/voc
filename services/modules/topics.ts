// services/modules/topics.ts
import { getAuthHeaders } from './auth';

const API_BASE = '/api';

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

export interface SampleReview {
  id: number;
  text: string;
  date: string;
  keywords: string[];
}

export interface TopicAnalysis {
  id: number;
  topic_id: number;
  analysis_date: string;
  total_matches: number;
  sentiment_positive: number;
  sentiment_negative: number;
  sentiment_neutral: number;
  period_start: string;
  period_end: string;
  ai_summary: string;
  pain_points: string[];
  recommendations: string[];
  sample_reviews: SampleReview[];
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

export const scanTopics = async (appId: string, startDate?: string, endDate?: string) => {
  const res = await fetch(`${API_BASE}/topics/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ appId, startDate, endDate })
  });
  return res.json();
};

export const analyzeTopic = async (topicId: number, appId?: string) => { // 👈 增加参数
  const res = await fetch(`${API_BASE}/topics/${topicId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, // 👈 确保 Content-Type
    body: JSON.stringify({ appId }) // 👈 发送 appId
  });
  return res.json();
};

export const fetchTopicHistory = async (topicId: number) => {
  const res = await fetch(`${API_BASE}/topics/${topicId}/history`);
  return res.json();
};