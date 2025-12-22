# VOC 数据库表结构与关系文档

## 一、数据库表概览

### 1. 系统基础表（用户/权限/配置）

#### 1.1 users（用户表）

* **用途** ：存储系统用户账号信息
* **主要字段** ：
* `id`：用户ID（主键）
* `username`：登录用户名（唯一）
* `password_hash`：密码哈希
* `display_name`：显示名称
* `role`：角色（admin/operator/viewer）
* `is_active`：是否启用
* `last_login`：最后登录时间

#### 1.2 app_configs（应用配置表）

* **用途** ：管理各个金融应用的基本信息
* **主要字段** ：
* `app_id`：应用ID（主键）
* `app_name`：应用名称
* `country`：所属国家
* `is_active`：是否启用

#### 1.3 email_subscriptions（邮件订阅表）

* **用途** ：管理周报邮件订阅配置
* **主要字段** ：
* `app_id`：关联的应用
* `email`：订阅邮箱
* `recipient_name`：收件人姓名

#### 1.4 ai_costs（AI费用记录表）

* **用途** ：追踪AI API调用费用
* **主要字段** ：
* `provider`：供应商（deepseek/qwen）
* `model`：使用的模型
* `operation_type`：操作类型（analysis/report/clustering等）
* `input_tokens`、`output_tokens`：token消耗
* `total_cost`：总费用

---

### 2. 核心反馈数据模型（Unified Feedback Model）

#### 2.1 voc_feedbacks（反馈主表）⭐

* **用途** ：存储所有用户反馈的元数据和AI分析结果
* **关键设计** ：
* 支持多数据源（`source`字段：google_play、udesk_chat、udesk_voice等）
* `external_id`：外部系统的ID（如GP的reviewId、Udesk的ticketId）
* `source_url`：跳转链接（可直达原始反馈）
* **核心字段** ：
* **标识** ：`id`、`source`、`external_id`
* **App信息** ：`app_id`、`app_name`、`country`、`version`
* **用户信息** ：`user_name`、`rating`（评分，仅GP有）
* **AI分析结果** ：
  * `category`：分类（Tech_Bug/Compliance_Risk/Product_Issue等）
  * `risk_level`：风险等级（High/Medium/Low）
  * `summary`：AI摘要
  * `root_cause`：根因分析
  * `action_advice`：行动建议
  * `suggested_reply`：建议回复
  * `sentiment_score`：情感分数
* **状态流转** ：
  * `process_status`：处理状态（raw/analyzed/replied/ignored）
  * `status`：业务状态（pending/confirmed/reported/in_progress/resolved/irrelevant）
* **时间** ：`feedback_time`（反馈发生时间）

#### 2.2 voc_feedback_messages（对话详情表）

* **用途** ：存储反馈的具体内容，支持多轮对话
* **主要字段** ：
* `feedback_id`：关联主表（外键）
* `sequence_num`：对话顺序（支持多轮）
* `role`：角色（user/agent/system）
* `content_type`：内容类型（text/image/audio/file）
* `content`：原文
* `translated_content`：中文翻译
* `file_url`：附件URL

---

### 3. 高级分析功能表

#### 3.1 topic_configs（专题配置表）

* **用途** ：配置关键词专题监控（如"双十一活动"、"人脸识别"）
* **作用域设计** ：
* `global`：全球通用
* `country`：特定国家
* `app`：特定应用（优先级最高）
* **主要字段** ：
* `name`：专题名称
* `keywords`：关键词数组（JSON）
* `scope`、`country`、`app_id`：作用域
* `is_active`、`start_date`、`end_date`：生效控制

#### 3.2 topic_matches（专题匹配记录表）

* **用途** ：记录每条评论匹配到哪些专题
* **关系** ：`topic_id` → `topic_configs`，`review_id` → `voc_feedbacks`

#### 3.3 topic_analysis（专题分析结果表）

* **用途** ：存储AI对专题的汇总分析
* **主要字段** ：
* `total_matches`：匹配数量
* `sentiment_positive/negative/neutral`：情感分布
* `ai_summary`：AI摘要
* `pain_points`：痛点列表（JSON）
* `recommendations`：改进建议（JSON）

#### 3.4 issue_clusters（问题聚类表）

* **用途** ：存储同类问题的聚类结果（每周自动生成）
* **主要字段** ：
* `week_number`、`year`：时间维度
* `cluster_title`：聚类标题（如"短信验证码收不到"）
* `cluster_rank`：TOP排名
* `review_count`、`percentage`：涉及数量和占比
* `review_ids`：关联评论ID列表（JSON）
* `root_cause_summary`：根因汇总
* `action_suggestion`：行动建议

#### 3.5 verification_configs（闭环验证配置表）

* **用途** ：配置需要跟踪验证的问题优化效果
* **核心逻辑** ：对比优化前后的数据变化
* **主要字段** ：
* `issue_type`：验证目标类型（category/cluster/keyword）
* `issue_value`：具体值
* `baseline_start/end`：基准期（优化前）
* `verify_start/end`：验证期（优化后）
* `optimization_desc`：优化措施描述
* `status`：验证状态（monitoring/resolved/worsened）

#### 3.6 verification_results（闭环验证结果表）

* **用途** ：存储每次验证的对比结果
* **主要字段** ：
* 基准期数据：`baseline_count`、`baseline_total`、`baseline_ratio`
* 验证期数据：`verify_count`、`verify_total`、`verify_ratio`
* 变化指标：`change_percent`、`conclusion`（resolved/improved/no_change/worsened）

#### 3.7 reports（报告存档表）

* **用途** ：存储自动生成的周报
* **主要字段** ：
* `app_id`、`week_number`、`year`：报告标识
* `content`：Markdown格式报告内容
* `summary_stats`：统计数据（JSON）
* `cluster_summary`：聚类摘要（JSON）
* `topic_summary`：专题摘要（JSON）
* `verification_summary`：验证摘要（JSON）

---

### 4. 业务辅助表

#### 4.1 status_logs（状态变更日志表）

* **用途** ：记录问题状态的每次变更
* **主要字段** ：
* `review_id`：关联反馈ID
* `old_status`、`new_status`：状态变更
* `user_id`、`user_name`：操作人
* `note`：备注

#### 4.2 scheduled_task_logs（定时任务日志表）

* **用途** ：记录定时任务执行情况
* **主要字段** ：
* `task_type`：任务类型（cluster/topic_scan/verification/weekly_report）
* `status`：执行状态（running/success/failed）
* `items_processed`：处理数量
* `error_message`：错误信息

---

## 二、表关系图

```
┌─────────────────────────────────────────────────────────────┐
│                     核心数据流                                │
└─────────────────────────────────────────────────────────────┘

【数据采集】
   GP Reviews / Udesk IM
          ↓
   voc_feedbacks (主表)
          ↓
   voc_feedback_messages (对话详情)

【AI分析】
   AI脚本读取 raw 数据 → 回填分析结果到 voc_feedbacks

【业务流转】
   voc_feedbacks.status 变更 → status_logs 记录日志

【高级功能】
   ┌─────────────────┬─────────────────┬─────────────────┐
   │  专题追踪        │  聚类分析        │  闭环验证        │
   │                 │                 │                 │
   │ topic_configs   │ issue_clusters  │ verification_   │
   │      ↓          │      ↑          │   configs       │
   │ topic_matches   │ (AI聚类结果)     │      ↓          │
   │      ↓          │                 │ verification_   │
   │ topic_analysis  │                 │   results       │
   └─────────────────┴─────────────────┴─────────────────┘
                      ↓
               【周报汇总】
                  reports
```

---

## 三、核心关系说明

### 3.1 一对多关系

* `voc_feedbacks` (1) → `voc_feedback_messages` (N)：一个反馈包含多条消息
* `topic_configs` (1) → `topic_matches` (N)：一个专题匹配多条评论
* `topic_configs` (1) → `topic_analysis` (N)：一个专题有多次分析记录
* `verification_configs` (1) → `verification_results` (N)：一个验证配置有多次验证结果

### 3.2 外键约束

* `voc_feedback_messages.feedback_id` → `voc_feedbacks.id`（级联删除）
* `topic_matches.topic_id` → `topic_configs.id`（级联删除）
* `topic_analysis.topic_id` → `topic_configs.id`（级联删除）
* `verification_results.config_id` → `verification_configs.id`（级联删除）

### 3.3 数据源扩展性

* `voc_feedbacks.source` 字段支持任意扩展：
  * `google_play`：当前已实现
  * `udesk_chat`：即将接入（IM客服对话）
  * `udesk_voice`：可扩展（语音客服）
  * 其他：可自由添加新数据源
