export type RiskLevel = 'High' | 'Medium' | 'Low';

export type Category = 
  | 'Tech_Bug' 
  | 'Compliance_Risk' 
  | 'Product_Issue' 
  | 'Positive' 
  | 'User_Error' 
  | 'Other';

export type ReviewStatus = 
  | 'pending'      // 待处理
  | 'irrelevant'   // 无意义
  | 'confirmed'    // 已确认
  | 'reported'     // 已反馈
  | 'in_progress'  // 处理中
  | 'resolved';    // 已解决

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: '待处理',
  irrelevant: '无意义',
  confirmed: '已确认',
  reported: '已反馈',
  in_progress: '处理中',
  resolved: '已解决',
};

export const STATUS_COLORS: Record<ReviewStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  irrelevant: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  reported: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
};

export interface VOCItem {
  id: string;
  date: string;
  country: string;
  source: string;
  appId: string;
  appName?: string;
  version: string;
  category: Category;
  summary: string;
  text: string;
  translated_text: string;
  risk_level: RiskLevel;
  score: number;
  // Status fields
  status: ReviewStatus;
  statusNote?: string;
  statusUpdatedAt?: string;
}

export interface PaginatedResponse {
  data: VOCItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  totalReviews: number;
  highRiskCount: number;
  complianceCount: number;
  bugCount: number;
}

export interface FilterParams {
  page: number;
  limit: number;
  category?: string;
  risk?: string;
  country?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  reportMode?: boolean;
}