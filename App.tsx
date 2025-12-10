import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { ReportArchive } from './pages/ReportArchive';
import { fetchVocData } from './services/api';
import { VOCItem } from './types';
import { Loader2, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [data, setData] = useState<VOCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchVocData({ page: 1, limit: 1000 });
      
      if (result && Array.isArray(result.data)) {
        setData(result.data);
      } else {
        console.warn('API returned unexpected format, defaulting to empty array');
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

  const renderContent = () => {
    if (loading && !refreshing && data.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p>Initializing VOC AI Agent...</p>
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
      case 'compliance':
        const complianceData = data.filter(i => i.category === 'Compliance_Risk' || i.riskLevel === 'High');
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Compliance Priority Queue</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>These items require immediate investigation by the Legal/Risk team.</p>
                  </div>
                </div>
              </div>
            </div>
            <Dashboard data={complianceData} />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            Work in progress...
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
            {refreshing ? 'Analyzing...' : 'Refresh Data'}
          </button>
        </div>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
