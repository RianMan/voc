import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, UserRole } from '../types';
import { 
  Users, Plus, Edit2, Trash2, Loader2, X, Check, Shield, Eye, Settings2 
} from 'lucide-react';

interface UserItem {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  last_login: string | null;
}

export const UserManagement: React.FC = () => {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'operator' as UserRole
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (e) {
      console.error('Load users failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      displayName: '',
      role: 'operator'
    });
    setError('');
    setShowModal(true);
  };

  const handleEdit = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      displayName: user.display_name || '',
      role: user.role
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingUser) {
        // 更新用户
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            displayName: formData.displayName,
            role: formData.role,
            password: formData.password || undefined
          })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '更新失败');
        }
      } else {
        // 创建用户
        if (!formData.username || !formData.password) {
          throw new Error('用户名和密码必填');
        }
        
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '创建失败');
        }
      }
      
      setShowModal(false);
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    if (!confirm(`确定要禁用用户 "${user.display_name || user.username}" 吗？`)) {
      return;
    }

    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      loadUsers();
    } catch (e) {
      console.error('Delete user failed', e);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !user.is_active })
      });
      loadUsers();
    } catch (e) {
      console.error('Toggle user failed', e);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Shield size={14} className="text-red-500" />;
      case 'operator': return <Settings2 size={14} className="text-blue-500" />;
      case 'viewer': return <Eye size={14} className="text-slate-400" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">用户管理</h2>
          <p className="text-sm text-slate-500">管理系统用户和权限</p>
        </div>
        
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          新增用户
        </button>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left font-medium text-slate-500">用户</th>
              <th className="px-6 py-4 text-left font-medium text-slate-500">角色</th>
              <th className="px-6 py-4 text-left font-medium text-slate-500">状态</th>
              <th className="px-6 py-4 text-left font-medium text-slate-500">最后登录</th>
              <th className="px-6 py-4 text-left font-medium text-slate-500">创建时间</th>
              <th className="px-6 py-4 text-right font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className={`hover:bg-slate-50 ${!user.is_active ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-800">{user.display_name || user.username}</p>
                    <p className="text-xs text-slate-400">@{user.username}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100">
                    {getRoleIcon(user.role)}
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    user.is_active 
                      ? 'bg-green-50 text-green-700' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {user.is_active ? '正常' : '已禁用'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {formatDate(user.last_login)}
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    {user.id !== currentUser?.id && (
                      <>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`p-2 hover:bg-slate-100 rounded-lg ${
                            user.is_active ? 'text-slate-500 hover:text-amber-600' : 'text-slate-400 hover:text-green-600'
                          }`}
                          title={user.is_active ? '禁用' : '启用'}
                        >
                          {user.is_active ? <Trash2 size={16} /> : <Check size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser ? '编辑用户' : '新增用户'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  用户名 {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                  placeholder="登录用户名"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  密码 {!editingUser && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={editingUser ? '留空则不修改' : '设置密码'}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  显示名称
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="用于显示的名称"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  角色
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">管理员 - 所有权限</option>
                  <option value="operator">操作员 - 处理问题</option>
                  <option value="viewer">访客 - 仅查看</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
