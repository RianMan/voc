import { Router } from 'express';
import { 
  authenticateUser, 
  createUser, 
  getAllUsers, 
  updateUser, 
  deleteUser,
  getUserById 
} from '../db/index.js';
import { 
  createSession, 
  destroySession, 
  authMiddleware, 
  requireRole 
} from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }
    
    const user = await authenticateUser(username, password);
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = createSession(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (e) {
    console.error('[Auth] Login failed:', e);
    res.status(500).json({ error: '登录失败' });
  }
});

/**
 * POST /api/auth/logout
 * 退出登录
 */
router.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    destroySession(token);
  }
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.display_name,
      role: req.user.role
    }
  });
});

/**
 * PUT /api/auth/password
 * 修改密码
 */
router.put('/auth/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入原密码和新密码' });
    }
    
    // 验证原密码
    const user = await authenticateUser(req.user.username, oldPassword);
    if (!user) {
      return res.status(400).json({ error: '原密码错误' });
    }
    
    // 更新密码
    await updateUser(req.user.id, { password: newPassword });
    
    res.json({ success: true });
  } catch (e) {
    console.error('[Auth] Change password failed:', e);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// ==================== 用户管理（仅管理员） ====================

/**
 * GET /api/users
 * 获取用户列表
 */
router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, data: users });
  } catch (e) {
    console.error('[Users] Get list failed:', e);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

/**
 * POST /api/users
 * 创建用户
 */
router.post('/users', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, displayName, role } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码必填' });
    }
    
    if (role && !['admin', 'operator', 'viewer'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    
    const result = await createUser(username, password, displayName || username, role || 'operator');
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, id: result.id });
  } catch (e) {
    console.error('[Users] Create failed:', e);
    res.status(500).json({ error: '创建用户失败' });
  }
});

/**
 * PUT /api/users/:id
 * 更新用户
 */
router.put('/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, role, isActive, password } = req.body;
    
    // 不能修改自己的角色
    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }
    
    const result = await updateUser(parseInt(id), { displayName, role, isActive, password });
    res.json(result);
  } catch (e) {
    console.error('[Users] Update failed:', e);
    res.status(500).json({ error: '更新用户失败' });
  }
});

/**
 * DELETE /api/users/:id
 * 删除用户（软删除）
 */
router.delete('/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // 不能删除自己
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    
    await deleteUser(parseInt(id));
    res.json({ success: true });
  } catch (e) {
    console.error('[Users] Delete failed:', e);
    res.status(500).json({ error: '删除用户失败' });
  }
});

export default router;
