// services/modules/notes.ts
import { authFetch } from './auth';

const API_BASE = '/api';

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