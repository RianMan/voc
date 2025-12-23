import crypto from 'crypto';

// ==================== 密码工具 ====================
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verify;
}

// ==================== 状态定义 ====================
export const STATUS = {
  PENDING: 'pending',
  IRRELEVANT: 'irrelevant',
  CONFIRMED: 'confirmed',
  REPORTED: 'reported',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
};

export const STATUS_LABELS = {
  pending: '待处理',
  irrelevant: '无意义',
  confirmed: '已确认',
  reported: '已反馈',
  in_progress: '处理中',
  resolved: '已解决',
};

export const ACTIVE_STATUSES = ['pending', 'confirmed', 'reported', 'in_progress'];