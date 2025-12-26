// 修改 rianman/voc/voc-feat-tomysql/services/api.ts 或新建 services/modules/groups.ts

export interface ReviewGroup {
  id: number;
  app_id: string;
  app_name: string;
  group_title: string;
  group_rank: number;
  review_count: number;
  percentage: number;
  year: number;
  month: number;
  status: string;
  root_cause_summary: string;
  action_suggestion: string;
  sample_reviews: string[];
}

// 获取聚类列表
export const fetchGroups = async (filters: { appId?: string; year?: number; month?: number }) => {
  const params = new URLSearchParams();
  if (filters.appId) params.append('appId', filters.appId);
  if (filters.year) params.append('year', String(filters.year));
  if (filters.month) params.append('month', String(filters.month));
  
  const res = await fetch(`/api/groups?${params.toString()}`);
  return res.json();
};

// 获取聚类下的具体评论
export const fetchGroupReviews = async (groupId: number) => {
  const res = await fetch(`/api/groups/${groupId}/reviews`);
  return res.json();
};

// 更新聚类状态
export const updateGroupStatus = async (groupId: number, status: string) => {
  const res = await fetch(`/api/groups/${groupId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return res.json();
};