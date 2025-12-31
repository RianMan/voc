import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, DatePicker, message, Select } from 'antd';
import { Sparkles } from 'lucide-react';
import { fetchMonthlyInsights, generateMonthlyInsights, createTask } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { TextArea } = Input;

export const MonthlyFeedbackList = () => {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  
  // 事项转化弹窗
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await fetchMonthlyInsights('com.mexicash.app', month);
    if (res.success) setData(res.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [month]);

  const handleGenerate = async () => {
    setGenerating(true);
    message.loading({ content: 'AI 正在提炼本月洞察，请稍候...', key: 'gen' });
    const res = await generateMonthlyInsights('com.mexicash.app', month);
    if (res.success) {
      message.success({ content: '提炼完成！', key: 'gen' });
      loadData();
    } else {
      message.error({ content: '生成失败', key: 'gen' });
    }
    setGenerating(false);
  };

  const openTaskModal = (item) => {
    setCurrentItem(item);
    form.setFieldsValue({
      title: item.problem_title,
      description: item.ai_suggestion,
      owner: item.owners?.[0] || '',
    });
    setIsModalOpen(true);
  };

  const handleCreateTask = async (values) => {
    const res = await createTask({
      sourceType: 'insight',
      sourceId: currentItem.id,
      originalProblem: currentItem.problem_title,
      title: values.title,
      description: values.description,
      businessValue: values.businessValue,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      ownerName: values.owner
    });

    if (res.success) {
      message.success('事项转化成功');
      setIsModalOpen(false);
      loadData();
    } else {
      message.error('转化失败');
    }
  };

  const columns = [
    { title: '问题', dataIndex: 'problem_title', width: 200, render: t => <span className="font-bold">{t}</span> },
    { title: '问题数量', dataIndex: 'problem_count', width: 100, align: 'center', sorter: (a,b) => a.problem_count - b.problem_count },
    { 
      title: '用户原声 (中文)', 
      width: 300,
      render: (_, r) => (
        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
          <p className="mb-1">{r.sample_translated}</p>
        </div>
      )
    },
    { 
      title: '优化建议', 
      dataIndex: 'ai_suggestion',
      render: t => <div className="text-sm text-slate-700 whitespace-pre-wrap">{t}</div>
    },
    {
      title: '关注部门/人',
      render: (_, r) => (
        <div className="space-y-1">
          {r.departments?.map((d, i) => (
            <Tag color="blue" key={d}>{d}: {r.owners?.[i] || '待定'}</Tag>
          ))}
        </div>
      )
    },
    {
      title: '操作',
      width: 140, // 稍微调宽一点
      render: (_, r) => (
        <div className="flex flex-col gap-2 items-start">
          {/* 1. 按钮始终显示，改个名字叫 "创建事项" 或 "继续转化" */}
          <Button size="small" type="primary" onClick={() => openTaskModal(r)}>
             转化事项
          </Button>
          
          {/* 2. 如果已经转化过，显示一个小标签作为历史提示，而不是阻断操作 */}
          {r.task_id && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
              已关联任务
            </span>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">反馈提炼</h2>
          <p className="text-slate-500">本月 MexiCash 核心问题聚合</p>
        </div>
        <div className="flex gap-4">
          <input 
            type="month" 
            value={month} 
            onChange={e => setMonth(e.target.value)} 
            className="border rounded-lg px-3 py-2 text-sm"
          />
          {user?.role === 'admin' && (
            <Button 
              type="primary" 
              icon={<Sparkles size={16} />} 
              onClick={handleGenerate} 
              loading={generating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              AI 重新分析
            </Button>
          )}
        </div>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading} 
        pagination={{ pageSize: 10 }}
      />

      <Modal 
        title="转化为执行事项" 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="title" label="事项标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="事项描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="businessValue" label="业务提升">
            <Input placeholder="例如：预计减少 20% 客诉" />
          </Form.Item>
          <Form.Item name="dateRange" label="起止时间">
            <DatePicker.RangePicker className="w-full" />
          </Form.Item>
          <Form.Item name="owner" label="跟进人">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};