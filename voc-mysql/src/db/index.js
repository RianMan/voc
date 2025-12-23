/**
 * 数据库模块统一导出
 * 保持向后兼容，所有旧代码的 import 不需要修改
 */

// 导出连接池
export { default as pool, default } from './connection.js';

// 导出工具函数
export * from './utils.js';

// 导出用户管理
export * from './users.js';

// 导出 VOC 数据查询
export * from './feedbacks.js';

// 导出状态管理
export * from './status.js';

// 导出报告存档
export * from './reports.js';

// 导出 AI 费用
export * from './costs.js';

// 导出 App 配置
export * from './apps.js';