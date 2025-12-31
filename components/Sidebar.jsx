// src/components/Sidebar.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, FileText, Target, CheckSquare, Settings, LogOut 
} from 'lucide-react';

export const Sidebar = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: '反馈洞察', icon: LayoutDashboard }, // 取消注释
    { id: 'monthly', label: '反馈提炼', icon: FileText },
    { id: 'topics', label: '专题关注', icon: Target },
    { id: 'tasks', label: '事项跟进', icon: CheckSquare },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 z-10">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-blue-500">VOC</span> Agent
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === item.id 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center font-bold">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="text-sm">
            <p className="font-medium">{user?.username}</p>
            <p className="text-xs text-slate-500">Operator</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white text-sm">
          <LogOut size={16} /> 退出登录
        </button>
      </div>
    </div>
  );
};