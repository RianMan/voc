import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Tag, message, Popconfirm, Card } from 'antd';
import { Plus, Trash2, Edit, Smartphone } from 'lucide-react';
import { fetchApps, createApp, deleteApp } from '../services/api';

export const AppManager = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const res = await fetchApps();
    if(res.success) setApps(res.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
        appId: record.app_id,
        appName: record.app_name,
        country: record.country,
        // JSON 回显为字符串方便编辑
        viewsStr: JSON.stringify(record.views || [], null, 2),
        // Udesk 回显
        udeskUrl: record.udesk_config?.apiUrl,
        udeskChannel: record.udesk_config?.channel
    });
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    // 默认模板
    form.setFieldsValue({
        viewsStr: JSON.stringify([{ country: "mx", lang: "es", label: "MX_es" }], null, 2),
        udeskUrl: 'http://biz-crm.mxgbus.com/backend/goapi/udesk/im-query-message'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
        const views = JSON.parse(values.viewsStr);
        const payload = {
            appId: values.appId,
            appName: values.appName,
            country: values.country,
            views, // 存入 views
            udeskConfig: { // 存入 udesk_config
                apiUrl: values.udeskUrl,
                channel: values.udeskChannel
            }
        };
        const res = await createApp(payload);
        if(res.success) {
            message.success('保存成功');
            setIsModalOpen(false);
            loadData();
        } else { message.error('保存失败'); }
    } catch (e) { message.error('JSON 格式错误'); }
  };

  const handleDelete = async (id) => {
      await deleteApp(id);
      loadData();
  };

  const columns = [
    { title: 'App ID', dataIndex: 'app_id', className: 'text-xs font-mono text-gray-500' },
    { title: '名称', dataIndex: 'app_name', render: t => <b>{t}</b> },
    { title: '国家', dataIndex: 'country', width: 80, render: t => <Tag>{t}</Tag> },
    { title: 'Udesk', render: (_, r) => r.udesk_config?.channel || '-' },
    {
        title: '操作',
        width: 100,
        render: (_, r) => (
            <div className="flex gap-2">
                <Button size="small" icon={<Edit size={14}/>} onClick={() => handleEdit(r)} />
                <Popconfirm title="删除?" onConfirm={() => handleDelete(r.app_id)}>
                    <Button size="small" danger icon={<Trash2 size={14}/>} />
                </Popconfirm>
            </div>
        )
    }
  ];

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Smartphone className="text-blue-600"/> 应用管理
            </h2>
            <Button type="primary" icon={<Plus size={16}/>} onClick={handleAdd}>新增 App</Button>
        </div>
        <Table dataSource={apps} columns={columns} rowKey="app_id" loading={loading} />
        
        <Modal title={editing ? "编辑应用" : "新增应用"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item name="appId" label="App ID" rules={[{required:true}]}><Input disabled={!!editing}/></Form.Item>
                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="appName" label="名称" rules={[{required:true}]}><Input/></Form.Item>
                    <Form.Item name="country" label="国家" rules={[{required:true}]}><Input/></Form.Item>
                </div>
                <Card size="small" title="Udesk 配置" className="mb-4 bg-slate-50">
                    <Form.Item name="udeskUrl" label="API URL"><Input className="text-xs font-mono"/></Form.Item>
                    <Form.Item name="udeskChannel" label="Channel"><Input placeholder="App Name"/></Form.Item>
                </Card>
                <Form.Item name="viewsStr" label="Google Play 视图 (JSON)"><Input.TextArea rows={3} className="font-mono text-xs"/></Form.Item>
            </Form>
        </Modal>
    </div>
  );
};