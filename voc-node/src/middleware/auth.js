import { getUserById } from '../db.js';

// 简单的 session 存储（生产环境应用 Redis）
const sessions = new Map();

export function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function createSession(user) {
  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时
  });
  return token;
}

export function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  
  return session;
}

export function destroySession(token) {
  sessions.delete(token);
}

// 认证中间件
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: '登录已过期' });
  }
  
  const user = getUserById(session.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: '用户不存在或已禁用' });
  }
  
  req.user = user;
  next();
}

// 角色检查中间件
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未登录' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
}

// 可选认证（不强制登录，但如果有token就解析用户）
export function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (token) {
    const session = getSession(token);
    if (session) {
      const user = getUserById(session.userId);
      if (user && user.is_active) {
        req.user = user;
      }
    }
  }
  
  next();
}
