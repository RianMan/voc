// 文件：pages/MonthlyTopicList.jsx
import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, DatePicker, message, Select, Drawer, List } from 'antd';
import { Sparkles, Settings, Plus, Trash2 } from 'lucide-react';
import { 
  fetchTopicTrends, generateTopicTrends, createTask,
  fetchTopicConfigs, createTopicConfig, deleteTopicConfig
} from '../services/api';

const { TextArea } = Input;
const { Option } = Select;

export const MonthlyTopicList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  
  // ✅ 修改1：selectedTopic 存储的是 topic_config_id (数字)，初始化为 null
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  
  // ... (保留 taskModal 和 configDrawer 状态)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [taskForm] = Form.useForm();
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [configForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await fetchTopicTrends('com.mexicash.app', month);
    if (res.success) setData(res.data);
    setLoading(false);
  };

  const loadConfigs = async () => {
    const res = await fetchTopicConfigs();
    if (res.success) {
      setConfigs(res.data);
      // ✅ 修改2：加载配置后，如果没有选中项，默认选中第一个专题
      if (res.data.length > 0 && !selectedTopicId) {
        setSelectedTopicId(res.data[0].id);
      }
    }
  };

  // 初始化加载
  useEffect(() => { 
    loadConfigs(); 
    loadData(); 
  }, [month]);

  // ... (保留 handleGenerate, handleCreateTask, handleAddConfig 等函数，逻辑不变)
  const handleGenerate = async () => {
    setGenerating(true);
    message.loading({ content: 'AI 正在扫描并拆分具体问题...', key: 'gen' });
    const res = await generateTopicTrends('com.mexicash.app', month);
    if (res.success) {
      message.success({ content: `分析完成，提取了 ${res.count} 个具体问题`, key: 'gen' });
      loadData();
    } else {
      message.error({ content: res.error || '生成失败', key: 'gen' });
    }
    setGenerating(false);
  };
  
  // ... (openTaskModal, handleCreateTask, handleAddConfig, handleDeleteConfig 保持不变)
  const openTaskModal = (item) => {
    setCurrentItem(item);
    taskForm.setFieldsValue({
      title: `${month} ${item.topic_name} 优化`,
      description: item.ai_suggestion,
      owner: item.owners?.[0] || '',
    });
    setIsTaskModalOpen(true);
  };

  const handleCreateTask = async (values) => {
      // 保持之前的逻辑
      const res = await createTask({
        sourceType: 'topic',
        sourceId: currentItem.id,
        originalProblem: currentItem.topic_name,
        title: values.title,
        description: values.description,
        businessValue: values.businessValue,
        startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
        ownerName: values.owner
      });
      if (res.success) {
        message.success('事项转化成功');
        setIsTaskModalOpen(false);
        loadData();
      }
  };

  const handleAddConfig = async (values) => {
      const keywords = values.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean);
      const res = await createTopicConfig({ name: values.name, keywords });
      if (res.success) {
        message.success('专题添加成功');
        configForm.resetFields();
        loadConfigs(); // 重新加载配置会触发 useEffect 更新 select
      }
  };
    
  const handleDeleteConfig = async (id) => {
      await deleteTopicConfig(id);
      loadConfigs();
  };

  // ✅ 修改3：前端过滤数据
  // 根据 topic_config_id 过滤，只显示当前选中专题下的子问题
  const filteredData = selectedTopicId 
    ? data.filter(d => d.topic_config_id === selectedTopicId)
    : [];

  const columns = [
    // ✅ 修改4：列名改为 "具体问题"
    { title: '具体细分问题', dataIndex: 'topic_name', width: 180, render: t => <span className="font-bold text-blue-700">{t}</span> },
    { title: '数量', dataIndex: 'issue_count', width: 80, align: 'center', sorter: (a,b) => a.issue_count - b.issue_count },
    { 
      title: '代表性原声', 
      width: 300,
      render: (_, r) => (
        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
          <p className="mb-1">{r.sample_translated}</p>
        </div>
      )
    },
    { 
      title: 'AI 优化建议', 
      dataIndex: 'ai_suggestion',
      render: t => <div className="text-sm text-slate-700 whitespace-pre-wrap">{t}</div>
    },
    {
      title: '关注部门/人',
      render: (_, r) => (
        <div className="space-y-1">
          {r.departments?.map((d, i) => (
            <Tag color="purple" key={d}>{d}: {r.owners?.[i] || '待定'}</Tag>
          ))}
        </div>
      )
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <div>
          {r.task_id ? (
            <Tag color="success">已转化</Tag>
          ) : (
            <Button size="small" type="primary" onClick={() => openTaskModal(r)}>转化事项</Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">专题关注</h2>
          <p className="text-slate-500">定向监控特定业务域下的具体痛点</p>
        </div>
        <div className="flex gap-4 items-center">
          {/* ✅ 修改5：移除 "所有问题"，强制单选 */}
          <Select 
            value={selectedTopicId} 
            onChange={setSelectedTopicId} 
            style={{ width: 160 }}
            placeholder="请选择监控专题"
            loading={configs.length === 0}
          >
            {configs.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
          </Select>

          <Button icon={<Settings size={16} />} onClick={() => setIsConfigDrawerOpen(true)}>管理专题</Button>
          
          <input 
            type="month" 
            value={month} 
            onChange={e => setMonth(e.target.value)} 
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <Button 
            type="primary" 
            icon={<Sparkles size={16} />} 
            onClick={handleGenerate} 
            loading={generating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            AI 扫描分析
          </Button>
        </div>
      </div>

      <Table 
        columns={columns} 
        dataSource={filteredData} 
        rowKey="id" 
        loading={loading} 
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: selectedTopicId ? '该专题下暂无发现问题' : '请先选择一个专题' }}
      />
      
      {/* ... Task Modal 和 Config Drawer 保持不变 ... */}
      <Modal 
        title="转化专题为事项" 
        open={isTaskModalOpen} 
        onCancel={() => setIsTaskModalOpen(false)}
        onOk={() => taskForm.submit()}
      >
        <Form form={taskForm} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="title" label="事项标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="事项描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="businessValue" label="业务提升">
            <Input placeholder="例如：降低该专题客诉率 10%" />
          </Form.Item>
          <Form.Item name="dateRange" label="起止时间">
            <DatePicker.RangePicker className="w-full" />
          </Form.Item>
          <Form.Item name="owner" label="跟进人">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="管理监控专题"
        width={500}
        open={isConfigDrawerOpen}
        onClose={() => setIsConfigDrawerOpen(false)}
      >
        <Form form={configForm} layout="vertical" onFinish={handleAddConfig} className="mb-8 p-4 bg-slate-50 rounded-lg border">
          <h3 className="font-bold mb-4 text-slate-700">添加新专题</h3>
          <Form.Item name="name" label="专题名称" rules={[{ required: true }]}>
            <Input placeholder="例如：催收服务" />
          </Form.Item>
          <Form.Item name="keywords" label="关键词范围 (逗号分隔)" rules={[{ required: true }]}>
            <Input placeholder="例如：杀全家, 威胁, 恐吓" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<Plus size={16} />} block>添加</Button>
        </Form>

        <List
          header={<div className="font-bold">已配置专题 ({configs.length})</div>}
          bordered
          dataSource={configs}
          renderItem={(item) => (
            <List.Item
              actions={[<Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleDeleteConfig(item.id)} />]}
            >
              <List.Item.Meta
                title={item.name}
                description={
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.keywords?.map(k => <Tag key={k}>{k}</Tag>)}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
};