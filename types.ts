export type RiskLevel = 'High' | 'Medium' | 'Low';

export type Category = 
  | 'Tech_Bug' 
  | 'Compliance_Risk' 
  | 'Product_Issue' 
  | 'Positive' 
  | 'User_Error' 
  | 'Other';

export type ReviewStatus = 
  | 'pending'
  | 'irrelevant'
  | 'confirmed'
  | 'reported'
  | 'in_progress'
  | 'resolved';

export type UserRole = 'admin' | 'operator' | 'viewer';

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: '待处理',
  irrelevant: '无意义',
  confirmed: '已确认',
  reported: '已反馈',
  in_progress: '处理中',
  resolved: '已解决',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  operator: '操作员',
  viewer: '访客',
};

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface VOCItem {
  id: string;
  date: string;
  country: string;
  source: string;
  sourceUrl?: string;
  appId: string;
  appName?: string;
  version: string;
  category: Category;
  summary: string;
  text: string;
  translated_text: string;
  risk_level: RiskLevel;
  riskLevel?: RiskLevel;
  score: number;
  status: ReviewStatus;
  statusNote?: string;
  statusUpdatedAt?: string;
  notesCount?: number;
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
  appId?: string;
  source?: string; 
}

export interface AppInfo {
  appId: string;
  appName: string;
  country: string;
  totalReviews: number;
}

export interface Report {
  id: number;
  app_id: string;
  app_name: string;
  report_type: string;
  week_number: number;
  year: number;
  title: string;
  content: string;
  summary_stats: string;
  compared_with_last: string;
  total_issues: number;
  new_issues: number;
  resolved_issues: number;
  pending_issues: number;
  generated_by: number;
  generated_by_name: string;
  created_at: string;
}

export interface StatusLog {
  id: number;
  review_id: string;
  old_status: string;
  new_status: string;
  user_id: number;
  user_name: string;
  note: string;
  created_at: string;
}

export interface ReviewNote {
  id: number;
  review_id: string;
  user_id: number;
  user_name: string;
  content: string;
  created_at: string;
}


export interface GenerateReportResponse {
  success: boolean;
  report: string;
  meta: {
    appId: string;
    appName: string;
    weekNumber: number;
    year: number;
    totalAnalyzed: number;
    newThisWeek: number;
    resolved: number;
    generatedBy: string;
    generatedAt: string;
  };
}