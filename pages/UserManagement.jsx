import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm, Switch } from 'antd';
import { UserPlus, Pencil, Trash2, Shield } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser } from '../services/api';

const { Option } = Select;

export const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    const res = await fetchUsers();
    if (res.success) {
      setUsers(res.data);
    } else {
      message.error(res.error || '加载用户失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      form.setFieldsValue({
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        isActive: user.is_active === 1
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ role: 'operator', isActive: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      let res;
      if (editingUser) {
        // 更新模式 (如果不填密码则不传)
        const payload = { ...values };
        if (!payload.password) delete payload.password;
        res = await updateUser(editingUser.id, payload);
      } else {
        // 创建模式
        res = await createUser(values);
      }

      if (res.success) {
        message.success(editingUser ? '用户更新成功' : '用户创建成功');
        setIsModalOpen(false);
        loadUsers();
      } else {
        message.error(res.error || '操作失败');
      }
    } catch (error) {
      message.error('网络错误');
    }
  };

  const handleDelete = async (id) => {
    const res = await deleteUser(id);
    if (res.success) {
      message.success('用户已删除');
      loadUsers();
    } else {
      message.error(res.error || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { 
      title: '用户名', 
      dataIndex: 'username',
      render: (t) => <span className="font-medium">{t}</span>
    },
    { title: '显示名称', dataIndex: 'display_name' },
    { 
      title: '角色', 
      dataIndex: 'role',
      render: (role) => {
        const colors = { admin: 'red', operator: 'blue', viewer: 'green' };
        return <Tag color={colors[role]}>{role.toUpperCase()}</Tag>;
      }
    },
    { 
      title: '状态', 
      dataIndex: 'is_active',
      render: (active) => active ? <Tag color="success">启用</Tag> : <Tag color="error">禁用</Tag>
    },
    { title: '最后登录', dataIndex: 'last_login', render: t => t ? new Date(t).toLocaleString() : '-' },
    {
      title: '操作',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button 
            size="small" 
            icon={<Pencil size={14} />} 
            onClick={() => handleOpenModal(record)}
          />
          <Popconfirm 
            title="确认删除该用户吗？" 
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-blue-600" /> 用户权限管理
          </h2>
          <p className="text-slate-500">管理系统账号与角色分配</p>
        </div>
        <Button type="primary" icon={<UserPlus size={16} />} onClick={() => handleOpenModal(null)}>
          新增用户
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="id" 
          loading={loading}
          pagination={false}
        />
      </div>

      <Modal
        title={editingUser ? "编辑用户" : "新增用户"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label="登录账号" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="例如：张三" />
          </Form.Item>
          
          <Form.Item 
            name="password" 
            label={editingUser ? "重置密码 (留空则不修改)" : "登录密码"}
            rules={[{ required: !editingUser, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingUser ? "不修改请留空" : "设置初始密码"} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="role" label="角色权限" rules={[{ required: true }]}>
              <Select>
                <Option value="operator">Operator (操作员)</Option>
                <Option value="viewer">Viewer (只读)</Option>
                <Option value="admin">Admin (管理员)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="isActive" label="账号状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};