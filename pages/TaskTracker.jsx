import React, { useEffect, useState } from 'react';
import { Table, Tag, Progress, Button, Modal, Form, Input, DatePicker, Select, message } from 'antd';
import { fetchTasks, updateTask } from '../services/api';
import { Edit } from 'lucide-react';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

export const TaskTracker = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 编辑弹窗状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = () => {
    setLoading(true);
    fetchTasks().then(res => {
      if (res.success) setTasks(res.data);
      setLoading(false);
    });
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    form.setFieldsValue({
      title: task.title,
      description: task.description,
      businessValue: task.business_value,
      owner: task.owner_name,
      status: task.status,
      dateRange: [
        task.start_date ? dayjs(task.start_date) : null,
        task.end_date ? dayjs(task.end_date) : null
      ]
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (values) => {
    const res = await updateTask(editingTask.id, {
      title: values.title,
      description: values.description,
      businessValue: values.businessValue,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      ownerName: values.owner,
      status: values.status
    });

    if (res.success) {
      message.success('更新成功');
      setIsEditModalOpen(false);
      loadTasks();
    } else {
      message.error('更新失败');
    }
  };

  const columns = [
    { 
      title: '问题来源', 
      dataIndex: 'original_problem', 
      width: 180,
      render: (t, r) => (
        <div>
          <div className="font-medium text-slate-700">{t}</div>
          <Tag className="mt-1" color={r.source_type === 'topic' ? 'purple' : 'blue'}>
            {r.source_type === 'topic' ? '专题' : '提炼'}
          </Tag>
        </div>
      )
    },
    { title: '事项标题', dataIndex: 'title', width: 200, render: t => <b>{t}</b> },
    { 
      title: '事项描述', 
      dataIndex: 'description', 
      width: 250,
      render: t => <div className="text-xs text-slate-500 line-clamp-2" title={t}>{t}</div>
    },
    { title: '业务价值', dataIndex: 'business_value', width: 150 },
    { 
      title: '跟进人', 
      dataIndex: 'owner_name',
      width: 100,
      render: t => <Tag color="geekblue">{t}</Tag>
    },
    { 
      title: '时间进度', 
      width: 180,
      render: (_, r) => {
        const start = new Date(r.start_date).getTime();
        const end = new Date(r.end_date).getTime();
        const now = Date.now();
        let percent = 0;
        if (end > start) percent = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
        
        return (
          <div>
            <div className="text-xs text-slate-400 mb-1">
              {r.start_date ? r.start_date.slice(0,10) : '-'} ~ {r.end_date ? r.end_date.slice(0,10) : '-'}
            </div>
            <Progress percent={Math.round(percent)} size="small" status={r.status === 'done' ? 'success' : 'active'} />
          </div>
        );
      }
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 100,
      render: s => (
        <Tag color={s === 'done' ? 'green' : 'processing'}>
          {s === 'done' ? '已完成' : '进行中'}
        </Tag>
      )
    },
    {
      title: '操作',
      width: 80,
      render: (_, r) => (
        <Button size="small" icon={<Edit size={14} />} onClick={() => handleEdit(r)}>编辑</Button>
      )
    }
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">事项跟进</h2>
      <Table 
        columns={columns} 
        dataSource={tasks} 
        rowKey="id" 
        loading={loading} 
        scroll={{ x: 1200 }}
      />

      <Modal
        title="编辑事项"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="title" label="事项标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="事项描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="businessValue" label="业务价值">
            <Input />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="owner" label="跟进人">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select>
                <Option value="pending">进行中</Option>
                <Option value="done">已完成</Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="dateRange" label="起止时间">
            <DatePicker.RangePicker className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};