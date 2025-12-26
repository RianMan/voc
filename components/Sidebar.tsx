import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, MessageSquare, Settings, FileText, Archive, Users, LogOut, Shield, Settings2, Eye,
  Coins, Tag, Layers, Target
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const { user, logout, isAdmin } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: '概览', icon: LayoutDashboard, roles: ['admin', 'operator', 'viewer'] },
    { id: 'reports', label: '问题处理', icon: MessageSquare, roles: ['admin', 'operator', 'viewer'] },
    { id: 'archive', label: '报告存档', icon: Archive, roles: ['admin', 'operator', 'viewer'] },
    
    // === 高级功能 ===
    { id: 'divider1', label: '高级功能', divider: true },
    { id: 'topics', label: '专题管理', icon: Tag, roles: ['admin', 'operator'] },
    { id: 'clusters', label: '聚类分析', icon: Layers, roles: ['admin', 'operator', 'viewer'] },
    { id: 'verification', label: '闭环验证', icon: Target, roles: ['admin', 'operator'] },
    
    // === 系统管理 ===
    { id: 'divider2', label: '系统管理', divider: true },
    { id: 'costs', label: 'AI 费用统计', icon: Coins, roles: ['admin'] },
    { id: 'users', label: '用户管理', icon: Users, roles: ['admin'] },
    { id: 'help', label: '使用帮助', icon: Users, roles: ['admin', 'operator', 'viewer'] },
    { id: 'settings', label: '设置', icon: Settings, roles: ['admin'] },
  ];

  // 根据用户角色过滤菜单
  const visibleMenuItems = menuItems.filter(item => 
    item.divider || item.roles?.includes(user?.role || 'viewer')
  );

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'admin': return <Shield size={12} />;
      case 'operator': return <Settings2 size={12} />;
      default: return <Eye size={12} />;
    }
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case 'admin': return '管理员';
      case 'operator': return '操作员';
      default: return '访客';
    }
  };

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-10 shadow-xl">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">VOC AI Agent</h1>
            <p className="text-xs text-slate-400">Fintech Intelligence</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          // 分隔符渲染
          if (item.divider) {
            return (
              <div key={item.id} className="pt-4 pb-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-4">
                  {item.label}
                </p>
              </div>
            );
          }
          
          const Icon = item.icon!;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 用户信息 */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                {(user?.displayName || user?.username || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {user?.displayName || user?.username}
                </p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  {getRoleIcon()}
                  {getRoleLabel()}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
};
