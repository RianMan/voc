import React, { useState, useEffect } from 'react';
import { Button, Card, message, Tag, InputNumber, Select } from 'antd';
import { Download, Bot, Database } from 'lucide-react';
import { triggerAnalyze, triggerFetchGP, triggerFetchUdesk, fetchApps } from '../services/api';

const { Option } = Select;

export const SystemAdmin = () => {
  const [loading, setLoading] = useState({ gp: false, udesk: false, analyze: false });
  const [days, setDays] = useState(7);
  const [targetAppId, setTargetAppId] = useState(null); // 选中的 App
  const [apps, setApps] = useState([]);

  // 加载 App 列表供选择
  useEffect(() => {
    fetchApps().then(res => {
        if(res.success) setApps(res.data);
    });
  }, []);

  const handleAction = async (type, apiFunc, name) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    message.loading({ content: `正在执行: ${name}...`, key: type, duration: 0 });
    
    try {
      // ✅ 将 days 和 targetAppId 传给 API
      // 注意：triggerAnalyze 不需要 days，但多传也没事；Fetch 需要 days
      const res = await apiFunc(days, targetAppId);
      
      if (res.success) {
        message.success({ content: `${name} 执行成功！`, key: type });
      } else {
        message.error({ content: `${name} 失败: ${res.error}`, key: type });
      }
    } catch (e) {
      message.error({ content: '网络异常', key: type });
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="text-blue-600" /> 系统维护
        </h2>
        <p className="text-slate-500">手动触发数据同步与 AI 分析任务</p>
      </div>

      {/* ✅ 全局配置栏 */}
      <div className="bg-white p-4 rounded-lg border mb-6 flex flex-wrap items-center gap-6 shadow-sm">
        
        {/* 时间选择 */}
        <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">抓取时间:</span>
            <InputNumber 
                addonBefore="最近" 
                addonAfter="天" 
                value={days} 
                onChange={setDays} 
                min={1} 
                max={365} 
            />
        </div>

        {/* App 选择 */}
        <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">目标应用:</span>
            <Select 
                value={targetAppId} 
                onChange={setTargetAppId} 
                style={{ width: 200 }}
                placeholder="全部应用 (All Apps)"
                allowClear
            >
                {apps.map(app => (
                    <Option key={app.app_id} value={app.app_id}>{app.app_name}</Option>
                ))}
            </Select>
        </div>
        
        <div className="text-xs text-slate-400 ml-auto">
            如果不选择应用，将对所有配置的 App 执行操作
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 卡片 1: GP */}
        <Card title="Google Play 同步" bordered={false} className="shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded">
                <span className="text-xs text-slate-500">Google Play Store</span>
                <Tag color="blue">增量</Tag>
            </div>
            <Button 
              type="primary" 
              icon={<Download size={16} />} 
              loading={loading.gp}
              // ✅ 传递参数逻辑改为在 handleAction 内部处理
              onClick={() => handleAction('gp', triggerFetchGP, 'Google Play 抓取')}
            >
              开始抓取
            </Button>
          </div>
        </Card>

        {/* 卡片 2: Udesk */}
        <Card title="Udesk 客服同步" bordered={false} className="shadow-sm">
          <div className="flex flex-col gap-4">
             <div className="flex justify-between items-center bg-slate-50 p-3 rounded">
                <span className="text-xs text-slate-500">Udesk IM/Ticket</span>
                <Tag color="cyan">增量</Tag>
            </div>
            <Button 
              type="primary" 
              icon={<Download size={16} />} 
              loading={loading.udesk}
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={() => handleAction('udesk', triggerFetchUdesk, 'Udesk 抓取')}
            >
              开始抓取
            </Button>
          </div>
        </Card>

        {/* 卡片 3: AI */}
        <Card title="AI 全量分析" bordered={false} className="shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded">
                <span className="text-xs text-slate-500">状态: raw -> analyzed</span>
                <Tag color="purple">DeepSeek</Tag>
            </div>
            <Button 
              type="primary" 
              icon={<Bot size={16} />} 
              loading={loading.analyze}
              className="bg-purple-600 hover:bg-purple-700"
              // ✅ analyze 只需要 targetAppId，但在 handleAction 里统一传了也没事
              onClick={() => handleAction('analyze', (d, id) => triggerAnalyze(id), 'AI 分析任务')}
            >
              执行分析
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};