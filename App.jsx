// src/App.jsx
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { MonthlyFeedbackList } from './pages/MonthlyFeedbackList';
import { MonthlyTopicList } from './pages/MonthlyTopicList';
import { UserManagement } from './pages/UserManagement';
import { TaskTracker } from './pages/TaskTracker';
import { Dashboard } from './pages/Dashboard';
import { SystemAdmin } from './pages/SystemAdmin';
import { AppManager } from './pages/AppManager';
import { Loader2 } from 'lucide-react';

const MainApp = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('monthly'); // 默认进提炼页

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin" /></div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />; // 添加路由
      case 'monthly': return <MonthlyFeedbackList />;
      case 'topics': return <MonthlyTopicList />;
      case 'tasks': return <TaskTracker />;
      case 'users': return user?.role === 'admin' ? <UserManagement /> : <div className="p-8">无权访问</div>;
      case 'system': return user?.role === 'admin' ? <SystemAdmin /> : <div>无权访问</div>;
      case 'app': return user?.role === 'admin' ? <AppManager /> : <div>无权访问</div>;
      
      // case 'settings': return <div className="p-8">设置页面开发中...</div>;
      default: return <MonthlyFeedbackList />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        {renderContent()}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}