-- =====================================================
-- VOC 数据库全量初始化脚本 (Final Version)
-- 包含：用户权限、App配置、反馈池、提炼洞察、专题监控、事项追踪
-- =====================================================

-- 1. 创建并使用数据库 (如果不存在)
CREATE DATABASE IF NOT EXISTS voc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE voc_db;

-- =====================================================
-- 第一部分：基础配置表
-- =====================================================

-- 1. 用户表 (登录管理)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'operator', -- admin, operator, viewer
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- 2. 应用配置表 (App管理)
-- 用于前端下拉框展示，以及关联数据归属
CREATE TABLE IF NOT EXISTS app_configs (
    app_id VARCHAR(100) PRIMARY KEY,
    app_name VARCHAR(100) NOT NULL,
    country VARCHAR(10),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化 MexiCash 数据 (防止空表导致前端不显示)
INSERT IGNORE INTO app_configs (app_id, app_name, country) VALUES 
('com.mexicash.app', 'MexiCash', 'MX');

-- =====================================================
-- 第二部分：核心数据池 (底层数据)
-- =====================================================

-- 3. 原始反馈主表 (存储所有抓取/同步进来的数据)
CREATE TABLE IF NOT EXISTS voc_feedbacks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- 来源标识
    source VARCHAR(50),          -- 'google_play', 'udesk_chat', 'udesk_voice'
    external_id VARCHAR(255),    -- 外部唯一ID (ReviewId / TicketId)
    source_url VARCHAR(500),     -- 跳转链接
    
    -- App信息
    app_id VARCHAR(100),
    app_name VARCHAR(100),
    country VARCHAR(10),
    version VARCHAR(50),
    
    -- 用户信息
    user_name VARCHAR(255),
    rating INT,                  -- 1-5星
    
    -- 内容 (基础)
    content TEXT,                -- 原文
    
    -- AI 基础分析 (清洗阶段写入)
    translated_content TEXT,     -- 中文翻译
    sentiment VARCHAR(20),       -- 【新增】Positive (好评) / Neutral (中评) / Negative (差评)
    risk_level VARCHAR(20) DEFAULT 'Low', -- High / Medium / Low
    category VARCHAR(50),        -- 基础分类 (资金/功能/催收/其他)
    
    -- 时间与状态
    feedback_time DATETIME,      -- 反馈发生时间
    process_status VARCHAR(20) DEFAULT 'raw', -- raw (待清洗) -> analyzed (已清洗)
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_ext (source, external_id),
    INDEX idx_time_app (feedback_time, app_id),
    INDEX idx_process (process_status)
);

-- 4. 对话详情表 (存储多轮对话或更详细的文本)
CREATE TABLE IF NOT EXISTS voc_feedback_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    feedback_id BIGINT,
    role VARCHAR(20),            -- 'user', 'agent'
    content LONGTEXT,            -- 消息原文
    translated_content LONGTEXT, -- 消息翻译
    FOREIGN KEY (feedback_id) REFERENCES voc_feedbacks(id) ON DELETE CASCADE
);

-- =====================================================
-- 第三部分：新业务表 (提炼/专题/事项)
-- =====================================================

-- 5. 月度反馈提炼表 (Monthly Insights)
-- 用于 "本月用户反馈提炼列表" 页面
CREATE TABLE IF NOT EXISTS monthly_insights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_month VARCHAR(20) NOT NULL, -- 批次月份，如 '2025-01'
    app_id VARCHAR(100) NOT NULL,
    
    -- 核心问题
    problem_title VARCHAR(255) NOT NULL, -- 聚合后的问题标题
    problem_count INT DEFAULT 0,         -- 问题数量 (GP+Udesk总和)
    
    -- 代表性原声 (AI 提取)
    sample_content TEXT,                 -- 原文
    sample_translated TEXT,              -- 中文翻译
    sample_source VARCHAR(50),           -- 来源
    sample_link VARCHAR(500),            -- 跳转链接
    
    -- AI 分析与分派
    ai_suggestion TEXT,                  -- 优化建议
    departments JSON,                    -- 关注部门 ['UI', '产品']
    owners JSON,                         -- 关注人 ['蔡光磊', '王玲']
    
    -- 业务操作状态
    is_marked TINYINT(1) DEFAULT 0,      -- 是否标记/收藏
    task_id INT DEFAULT NULL,            -- 关联的事项ID (如果不为空，说明已转化)
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_month_app (batch_month, app_id)
);

-- 6. 专题配置表 (Topic Configs)
-- 用于 "专题管理"
CREATE TABLE IF NOT EXISTS topic_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,          -- 专题名称 (如"暴力催收")
    keywords JSON NOT NULL,              -- 关键词列表 ["杀全家", "威胁"]
    is_active TINYINT DEFAULT 1,         -- 开关
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 专题趋势表 (Topic Trends)
-- 用于 "本月关注专题列表" 页面
CREATE TABLE IF NOT EXISTS topic_trends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_config_id INT NOT NULL,        -- 关联配置ID
    topic_name VARCHAR(100),             -- 冗余名称，方便查询
    batch_month VARCHAR(20) NOT NULL,    -- 月份 '2025-01'
    app_id VARCHAR(100),
    
    issue_count INT DEFAULT 0,           -- 命中数量
    
    -- 代表性原声
    sample_content TEXT,
    sample_translated TEXT,
    sample_source VARCHAR(50),
    sample_link VARCHAR(500),
    
    -- AI 分析
    ai_suggestion TEXT,
    departments JSON,
    owners JSON,
    
    -- 状态
    is_marked TINYINT(1) DEFAULT 0,
    task_id INT DEFAULT NULL,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_config_id) REFERENCES topic_configs(id) ON DELETE CASCADE
);

-- 8. 事项追踪表 (Action Tasks)
-- 用于 "事项跟进" 页面，存储转化后的任务
CREATE TABLE IF NOT EXISTS action_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- 来源追踪 (反向关联)
    source_type VARCHAR(20),      -- 'insight' (来自提炼) 或 'topic' (来自专题)
    source_id INT,                -- 对应表的主键ID
    original_problem VARCHAR(255),-- 原始问题标题/专题名
    
    -- 事项详情 (弹窗填写的字段)
    title VARCHAR(255) NOT NULL,  -- 事项标题
    description TEXT,             -- 事项描述
    business_value VARCHAR(255),  -- 业务提升
    
    start_date DATE,              -- 开始时间
    end_date DATE,                -- 完成时间
    owner_name VARCHAR(100),      -- 跟进人
    
    -- 任务状态
    status VARCHAR(50) DEFAULT 'pending', -- pending (进行中), done (已完成)
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);