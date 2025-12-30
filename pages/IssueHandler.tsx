import React, { useState, useEffect } from 'react';
import { 
  Loader2, FileText, ArrowLeft, Search, ExternalLink 
} from 'lucide-react';
import { 
  Card, Button, Tag, Space, Select, DatePicker, Drawer, Timeline, 
  Input, message, Popconfirm, Tooltip, Avatar, Typography, Divider 
} from 'antd';
import { 
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, 
  UserOutlined, GoogleOutlined, CommentOutlined, RobotOutlined,
  PlayCircleOutlined, SyncOutlined
} from '@ant-design/icons';
import { fetchApps, generateWeeklyReport } from '../services/api';
import { formatDate } from '../tools';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const API_BASE = '/api';

// Markdown 解析器保持不变
function parseMarkdown(md: string): string {
  // ... (保留原有的 parseMarkdown 函数逻辑)
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 text-slate-800">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-4 text-slate-900 border-b pb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
    .replace(/^(?!<[hlo]|<li|<hr)(.+)$/gm, '<p class="my-2 text-slate-600">$1</p>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc space-y-1 my-2">$&</ul>');
}

export const IssueHandler: React.FC = () => {
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [apps, setApps] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 报告相关
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMeta, setReportMeta] = useState<any>(null);
  
  // 筛选
  const [filters, setFilters] = useState({ appId: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [detailFilters, setDetailFilters] = useState({ keyword: '', source: '' });
  
  // 操作日志抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeLogGroup, setActiveLogGroup] = useState<any>(null);
  const [remarkInput, setRemarkInput] = useState('');
  const [updatingGroup, setUpdatingGroup] = useState(false);

  useEffect(() => {
    const initApps = async () => {
      const res = await fetchApps();
      if (res.data?.length > 0) {
        setApps(res.data);
        setFilters(f => ({ ...f, appId: res.data[0].appId }));
      }
    };
    initApps();
  }, []);

  useEffect(() => {
    if (filters.appId && view === 'list') loadGroups();
  }, [filters, view]);

  useEffect(() => {
    if (view === 'detail' && selectedGroup) loadReviews();
  }, [detailFilters]);

  const loadGroups = async () => {
    setLoading(true);
    try {
        const params = new URLSearchParams({ ...filters } as any);
        const res = await fetch(`${API_BASE}/groups?${params}`).then(r => r.json());
        setGroups(res.data || []);
    } finally {
        setLoading(false);
    }
  };

  const loadReviews = async () => {
    const params = new URLSearchParams({ 
      keyword: detailFilters.keyword, 
      source: detailFilters.source 
    });
    const res = await fetch(`${API_BASE}/groups/${selectedGroup.id}/reviews?${params}`).then(r => r.json());
    setReviews(res.data || []);
  };

  // 更新状态 (快速操作)
  const handleUpdateStatus = async (group: any, newStatus: string) => {
    try {
        await fetch(`${API_BASE}/groups/${group.id}/processing`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus, 
                remark: group.remark, // 保持原有备注
                operator: user?.displayName || user?.username || 'Operator' 
            })
        });
        message.success(`状态已更新为 ${newStatus}`);
        loadGroups();
    } catch (e) {
        message.error('更新失败');
    }
  };

  // 在抽屉中保存备注
  const handleSaveRemark = async () => {
    if (!activeLogGroup) return;
    setUpdatingGroup(true);
    try {
        await fetch(`${API_BASE}/groups/${activeLogGroup.id}/processing`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: activeLogGroup.processing_status, // 保持原有状态
                remark: remarkInput, 
                operator: user?.displayName || user?.username || 'Operator' 
            })
        });
        message.success('备注/日志已保存');
        setDrawerOpen(false);
        loadGroups();
    } catch (e) {
        message.error('保存失败');
    } finally {
        setUpdatingGroup(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
      if (!filters.appId) return message.warning('请先选择一个App');
      
      setGeneratingReport(true);
      try {
        const data = await generateWeeklyReport(filters.appId, 0);
        if (data.success) {
          setReportContent(data.report);
          setReportMeta(data.meta);
          setShowReportModal(true);
          message.success('周报生成成功');
        } else {
          message.error('生成失败');
        }
      } catch (e) {
        message.error('生成失败，请重试');
      } finally {
        setGeneratingReport(false);
      }
  };

  const handleEnterDetail = (group: any) => {
    setSelectedGroup(group);
    setReviews([]); // 先清空，等待加载
    
    // 初始化详情页筛选器
    setDetailFilters({ keyword: '', source: '' });
    
    setView('detail');
    
    // 立即加载 (useEffect 会处理 filter 变化，这里手动触发第一次)
    const initialParams = new URLSearchParams({ keyword: '', source: '' });
    fetch(`${API_BASE}/groups/${group.id}/reviews?${initialParams}`)
        .then(r => r.json())
        .then(res => setReviews(res.data || []));
  };

  const openLogDrawer = (group: any, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveLogGroup(group);
      setRemarkInput(group.remark || '');
      setDrawerOpen(true);
  };

  // 状态颜色映射
  const getStatusTag = (status: string) => {
      switch (status) {
          case 'resolved': return <Tag icon={<CheckCircleOutlined />} color="success">已解决</Tag>;
          case 'processing': return <Tag icon={<SyncOutlined spin />} color="processing">处理中</Tag>;
          case 'ignored': return <Tag icon={<CloseCircleOutlined />} color="default">已忽略</Tag>;
          default: return <Tag icon={<ClockCircleOutlined />} color="warning">待处理</Tag>;
      }
  };

  // 列表视图
  const renderListView = () => (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800 m-0">问题治理中心</h2>
            <Select 
                value={filters.appId} 
                onChange={v => setFilters({...filters, appId: v})}
                style={{ width: 200 }}
                size="large"
            >
                {apps.map(app => <Option key={app.appId} value={app.appId}>{app.appName}</Option>)}
            </Select>
            <div className="flex items-center bg-slate-50 rounded-lg p-1">
                <Input 
                    type="number" 
                    value={filters.year} 
                    onChange={e => setFilters({...filters, year: parseInt(e.target.value)})} 
                    style={{ width: 80 }} 
                    variant="borderless"
                />
                <span className="text-slate-400">年</span>
                <Select 
                    value={filters.month} 
                    onChange={v => setFilters({...filters, month: v})}
                    variant="borderless"
                    style={{ width: 80 }}
                >
                    {[...Array(12)].map((_, i) => <Option key={i+1} value={i+1}>{i+1}月</Option>)}
                </Select>
            </div>
        </div>
        <Button 
            type="primary" 
            icon={generatingReport ? <Loader2 className="animate-spin" /> : <FileText size={16} />}
            onClick={handleGenerateWeeklyReport}
            loading={generatingReport}
            disabled={!filters.appId}
        >
            生成本周周报
        </Button>
      </div>

      {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
      ) : (
          <div className="grid gap-4">
            {groups.map(group => {
                // 计算来源总数 (为了展示 "总计 77")
                const gpCount = group.source_breakdown?.google_play || 0;
                const udeskCount = group.source_breakdown?.udesk || 0;
                const totalCount = group.review_count;

                return (
                  <Card key={group.id} hoverable bodyStyle={{ padding: '20px' }} className="border-slate-200">
                    <div className="flex items-start gap-6">
                        {/* 排名 */}
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-xl text-slate-500 flex-shrink-0">
                            {group.group_rank}
                        </div>

                        {/* 主体内容 */}
                        <div className="flex-1 cursor-pointer" onClick={() => handleEnterDetail(group)}>
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-slate-800 m-0 hover:text-blue-600 transition-colors">
                                    {group.group_title}
                                </h3>
                                {getStatusTag(group.processing_status)}
                            </div>
                            
                            {/* 来源分布展示 (优化点 2) */}
                            <Space size="large" className="text-slate-500 text-sm">
                                <span className="font-medium text-slate-800">总计 {totalCount} 条</span>
                                <Divider type="vertical" />
                                <Space>
                                    <Tooltip title="Google Play 评论数">
                                        <Tag icon={<GoogleOutlined />} color={gpCount > 0 ? "success" : "default"}>
                                            GP: {gpCount}
                                        </Tag>
                                    </Tooltip>
                                    <Tooltip title="Udesk 工单数">
                                        <Tag icon={<RobotOutlined />} color={udeskCount > 0 ? "geekblue" : "default"}>
                                            Udesk: {udeskCount}
                                        </Tag>
                                    </Tooltip>
                                </Space>
                            </Space>

                            {group.remark && (
                                <div className="mt-3 bg-amber-50 text-amber-700 px-3 py-1.5 rounded text-sm inline-block">
                                    <CommentOutlined className="mr-2" />
                                    {group.remark}
                                </div>
                            )}
                        </div>

                        {/* 操作区 (优化点 1: 平铺操作) */}
                        <div className="flex flex-col gap-2 items-end min-w-[140px]">
                            {/* 状态操作按钮 */}
                            <Space.Compact>
                                {group.processing_status !== 'resolved' && (
                                    <Popconfirm title="确定标记为已解决？" onConfirm={() => handleUpdateStatus(group, 'resolved')}>
                                        <Button size="small" type="text" className="text-green-600 hover:bg-green-50">
                                            解决
                                        </Button>
                                    </Popconfirm>
                                )}
                                {group.processing_status === 'pending' && (
                                    <Popconfirm title="确定标记为处理中？" onConfirm={() => handleUpdateStatus(group, 'processing')}>
                                        <Button size="small" type="text" className="text-blue-600 hover:bg-blue-50">
                                            跟进
                                        </Button>
                                    </Popconfirm>
                                )}
                                {group.processing_status !== 'ignored' && (
                                    <Popconfirm title="确定忽略此问题？" onConfirm={() => handleUpdateStatus(group, 'ignored')}>
                                        <Button size="small" type="text" className="text-slate-400 hover:bg-slate-100">
                                            忽略
                                        </Button>
                                    </Popconfirm>
                                )}
                            </Space.Compact>

                            {/* 日志/详情按钮 */}
                            <Button 
                                size="small" 
                                icon={<ClockCircleOutlined />} 
                                onClick={(e) => openLogDrawer(group, e)}
                            >
                                操作日志
                            </Button>
                            
                            {group.operator && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    <UserOutlined /> {group.operator}
                                </Text>
                            )}
                        </div>
                    </div>
                  </Card>
                );
            })}
          </div>
      )}

      {/* 状态流转/日志抽屉 */}
      <Drawer
        title={
            <div className="flex items-center gap-2">
                <span>操作日志</span>
                <Tag>{activeLogGroup?.group_title}</Tag>
            </div>
        }
        width={500}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
            <div className="flex justify-end gap-2">
                <Button onClick={() => setDrawerOpen(false)}>取消</Button>
                <Button type="primary" onClick={handleSaveRemark} loading={updatingGroup}>保存备注</Button>
            </div>
        }
      >
        <div className="space-y-6">
            <div>
                <h4 className="mb-2 font-bold text-slate-700">处理进度流转</h4>
                <Timeline
                    items={[
                        {
                            color: 'green',
                            children: (
                                <>
                                    <Text strong>创建时间</Text>
                                    <br/>
                                    <Text type="secondary" className="text-xs">{formatDate(activeLogGroup?.created_at)}</Text>
                                </>
                            ),
                        },
                        // 这里如果后端有完整 logs 表支持，可以 map 出来。目前展示最后一次更新。
                        activeLogGroup?.updated_at !== activeLogGroup?.created_at && {
                            color: 'blue',
                            children: (
                                <>
                                    <Text strong>最后更新</Text> 
                                    <Tag className="ml-2">{getStatusTag(activeLogGroup?.processing_status)}</Tag>
                                    <br/>
                                    <Space size="small" className="text-xs text-slate-500 mt-1">
                                        <UserOutlined /> {activeLogGroup?.operator || 'System'}
                                        <ClockCircleOutlined /> {formatDate(activeLogGroup?.updated_at)}
                                    </Space>
                                </>
                            )
                        }
                    ].filter(Boolean) as any}
                />
            </div>

            <Divider />

            <div>
                <h4 className="mb-2 font-bold text-slate-700">添加备注/进度说明</h4>
                <TextArea 
                    rows={4} 
                    value={remarkInput} 
                    onChange={e => setRemarkInput(e.target.value)}
                    placeholder="在此记录处理进度、原因分析或解决方案..."
                />
            </div>
        </div>
      </Drawer>

      {/* 周报预览 Modal */}
      {showReportModal && reportContent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold">{reportMeta?.appName} 周报</h3>
                <p className="text-sm text-slate-500">
                  {reportMeta?.year}年第{reportMeta?.weekNumber}周
                </p>
              </div>
              <Button type="text" icon={<div className="i-lucide-x" />} onClick={() => setShowReportModal(false)}>X</Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div 
                className="prose prose-slate prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(reportContent) }} 
              />
            </div>
            
            <div className="p-4 border-t flex justify-end gap-3">
              <Button onClick={() => {
                  navigator.clipboard.writeText(reportContent);
                  message.success('已复制到剪贴板');
              }}>
                复制内容
              </Button>
              <Button type="primary" onClick={() => setShowReportModal(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 详情视图 (保持大部分原有逻辑，稍微美化)
  const renderDetailView = () => (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Button icon={<ArrowLeft size={16} />} onClick={() => setView('list')}>返回列表</Button>
        <h2 className="text-xl font-bold m-0">{selectedGroup?.group_title}</h2>
      </div>

      <Card>
        <div className="flex gap-4 items-center">
            <Input 
                prefix={<Search size={16} className="text-slate-400" />} 
                placeholder="搜索评论内容..." 
                value={detailFilters.keyword}
                onChange={e => setDetailFilters({...detailFilters, keyword: e.target.value})}
                style={{ width: 300 }}
            />
            <Select 
                value={detailFilters.source} 
                onChange={v => setDetailFilters({...detailFilters, source: v})}
                style={{ width: 150 }}
            >
                <Option value="">所有来源</Option>
                <Option value="google_play">Google Play</Option>
                <Option value="udesk">Udesk 客服</Option>
            </Select>
        </div>
      </Card>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {reviews.map((rev, index) => (
            <div key={rev.id || index} className="p-6 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <Tag color={rev.source === 'google_play' ? 'green' : 'geekblue'}>
                            {rev.source === 'google_play' ? 'Google Play' : 'Udesk'}
                        </Tag>
                        <span className="text-xs text-slate-500">{rev.country} · {formatDate(rev.date)}</span>
                        {rev.source !== 'google_play' && (
                            <Tag bordered={false}>{rev.id}</Tag>
                        )}
                    </div>
                    {rev.source === 'google_play' && rev.sourceUrl && (
                        <a href={rev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 flex items-center gap-1 text-xs hover:underline">
                            查看详情 <ExternalLink size={12} />
                        </a>
                    )}
                </div>
                
                <Paragraph className="text-sm font-medium mb-2">
                    {rev.translated_text || rev.text}
                </Paragraph>

                {(rev.translated_text && rev.text) && (
                    <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 italic">
                        原文: {rev.text}
                    </div>
                )}
            </div>
        ))}
        {reviews.length === 0 && <div className="p-10 text-center text-slate-400">暂无符合条件的评论</div>}
      </div>
    </div>
  );

  return view === 'list' ? renderListView() : renderDetailView();
};