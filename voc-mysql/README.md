# VOC 用户反馈分析系统

## 快速理解（30 秒）

**核心功能**：抓取 Google Play 评论 → AI 分析 → 生成周报 → 闭环验证

**技术栈**：Node.js + MySQL + OpenAI API

**核心流程**：

```
GP/Udesk → voc_feedbacks (raw) → AI分析 → analyzed → 人工处理 → resolved
```

## 项目结构

```
src/
├── db/              # 数据库操作（8个模块）
│   ├── connection.js   # 连接池
│   ├── feedbacks.js    # VOC 数据查询
│   ├── status.js       # 状态管理
│   └── ...
├── routes/          # API 路由
│   ├── voc.js          # VOC 数据 API
│   ├── status.js       # 状态管理 API
│   ├── report.js       # 报告生成 API
│   └── advancedRoutes.js  # 高级功能 API
├── services/        # 业务逻辑
│   ├── ReportService.js      # 基础报告
│   ├── WeeklyReportService.js # 高级报告（聚类+专题+验证）
│   ├── TopicService.js       # 关键词专题追踪
│   ├── ClusterService.js     # 智能聚类
│   ├── VerificationService.js # 闭环验证
│   └── dataLoader.js         # 数据加载
├── fetch.js         # 数据抓取（GP）
└── analyze.js       # AI 分析脚本
```

## 核心数据表（3张）

1. **voc_feedbacks**：反馈主表（含 AI 分析结果）
2. **voc_feedback_messages**：对话详情（支持多轮）
3. **verification_configs/results**：闭环验证

详见 `init.sql` 第 1-100 行

## 核心 Service

| Service             | 职责                     | 文件位置                            |
| ------------------- | ------------------------ | ----------------------------------- |
| ReportService       | 基础周报生成             | `services/ReportService.js`       |
| WeeklyReportService | 高级周报（整合所有功能） | `services/WeeklyReportService.js` |
| TopicService        | 关键词专题追踪           | `services/TopicService.js`        |
| ClusterService      | 问题智能聚类             | `services/ClusterService.js`      |
| VerificationService | 优化效果验证             | `services/VerificationService.js` |

## 常见问题定位

### 1. 状态管理相关

- **文件**：`src/db/status.js` + `routes/status.js`
- **API**：`PUT /api/voc/:id/status`

### 2. 报告生成相关

- **基础报告**：`services/ReportService.js`
- **高级报告**：`services/WeeklyReportService.js`
- **API**：`POST /api/report/generate-app`

### 3. 闭环验证相关

- **文件**：`services/VerificationService.js`
- **API**：`POST /api/verifications`

### 4. 数据库相关

- **连接**：`src/db/connection.js`
- **查询**：`src/db/feedbacks.js`
- **结构**：`init.sql`

## 启动命令

```bash
npm start          # 启动服务器
npm run fetch      # 抓取 GP 数据
npm run analyze    # AI 分析
```

## 环境变量

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=voc_db
DEEPSEEK_API_KEY=sk-xxx
# 或
TONGYI_API_KEY=sk-xxx
```
