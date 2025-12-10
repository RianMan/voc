import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { ReportArchive } from './pages/ReportArchive';
import { UserManagement } from './pages/UserManagement';
import { LoginPage } from './pages/LoginPage';
import { fetchVocData } from './services/api';
import { VOCItem } from './types';
import { Loader2, RefreshCw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [data, setData] = useState<VOCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchVocData({ page: 1, limit: 1000 });
      
      if (result && Array.isArray(result.data)) {
        setData(result.data);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error("Failed to load dashboard data", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-500 mx-auto mb-4" size={48} />
          <p className="text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录
  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    if (loading && !refreshing && data.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p>加载数据中...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard data={data} />;
      case 'reports':
        return <Reports />; 
      case 'archive':
        return <ReportArchive />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">系统设置</h2>
            <p className="text-slate-500">设置页面开发中...</p>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            页面开发中...
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen relative">
        <div className="flex justify-end mb-6">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '刷新中...' : '刷新数据'}
          </button>
        </div>

        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
