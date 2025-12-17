-- =====================================================
-- VOC 数据库全量初始化脚本 (Consolidated Version)
-- 包含：基础功能、高级分析(聚类/专题/验证)、统一反馈模型
-- =====================================================

-- 1. 重置数据库
DROP DATABASE IF EXISTS voc_db;
CREATE DATABASE voc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE voc_db;

-- =====================================================
-- 第一部分：系统基础表 (用户/权限/配置)
-- =====================================================

-- 用户表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL
) ENGINE=InnoDB;

-- App配置表
CREATE TABLE app_configs (
    app_id VARCHAR(255) PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    country VARCHAR(10),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 邮件订阅配置表
CREATE TABLE email_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_app_email (app_id, email)
) ENGINE=InnoDB;

-- AI费用记录表
CREATE TABLE ai_costs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50),
    model VARCHAR(100),
    operation_type VARCHAR(50),
    input_tokens INT,
    output_tokens INT,
    total_cost DECIMAL(10, 6),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_operation_type (operation_type)
) ENGINE=InnoDB;

-- =====================================================
-- 第二部分：核心反馈数据模型 (Unified Feedback Model)
-- 取代了原有的 conversations / raw_reviews 概念
-- =====================================================

-- 1. 反馈主表 (存储元数据和AI分析结果)
CREATE TABLE voc_feedbacks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- 核心标识
    source VARCHAR(50) NOT NULL COMMENT '来源: google_play, udesk_chat, udesk_voice 等，可自由扩展',
    external_id VARCHAR(255) NOT NULL COMMENT '外部ID (ReviewId / TicketId)',
    source_url VARCHAR(500) DEFAULT NULL COMMENT '跳转链接(GP链接或工单后台链接)',
    
    -- App信息
    app_id VARCHAR(100) NOT NULL,
    app_name VARCHAR(100),
    country VARCHAR(10),
    version VARCHAR(50),
    
    -- 用户信息 (已去敏感，仅保留ID/Name用于串联)
    user_name VARCHAR(255),
    rating INT DEFAULT NULL COMMENT '评分(1-5，仅针对评论)',
    
    -- AI 分析结果 (分析脚本回填这里)
    category VARCHAR(50) COMMENT 'AI分析分类',
    risk_level VARCHAR(20) DEFAULT 'Low' COMMENT 'High, Medium, Low',
    summary TEXT COMMENT 'AI摘要',
    root_cause TEXT COMMENT 'AI根因推断',
    action_advice TEXT COMMENT 'AI行动建议',
    suggested_reply TEXT COMMENT 'AI建议回复',
    sentiment_score DECIMAL(3,2) COMMENT '情感分数',
    
    -- 状态流转
    process_status VARCHAR(20) DEFAULT 'raw' COMMENT 'raw:待分析, analyzed:已分析, replied:已回复, ignored:忽略',
    is_replied TINYINT(1) DEFAULT 0 COMMENT '是否已在源平台回复',
    
    -- 业务状态 (人工处理状态)
    status ENUM('pending', 'irrelevant', 'confirmed', 'reported', 'in_progress', 'resolved') DEFAULT 'pending',
    assignee VARCHAR(100),
    note TEXT,
    
    -- 时间
    feedback_time DATETIME NOT NULL COMMENT '反馈发生时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_source_external (source, external_id),
    INDEX idx_app_time (app_id, feedback_time),
    INDEX idx_status (process_status),
    INDEX idx_biz_status (status),
    INDEX idx_risk (risk_level)
) ENGINE=InnoDB;

-- 2. 对话详情表 (存储具体内容，支持多轮对话)
CREATE TABLE voc_feedback_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    feedback_id BIGINT NOT NULL,
    
    sequence_num INT NOT NULL DEFAULT 1 COMMENT '对话顺序',
    role VARCHAR(20) NOT NULL COMMENT 'user, agent, system',
    content_type VARCHAR(20) DEFAULT 'text', -- text, image, audio, file
    
    content LONGTEXT,            -- 原文
    translated_content LONGTEXT, -- 中文翻译
    file_url VARCHAR(500),       -- 如果是图片/音频，存储URL
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (feedback_id) REFERENCES voc_feedbacks(id) ON DELETE CASCADE,
    INDEX idx_feedback (feedback_id)
) ENGINE=InnoDB;

-- =====================================================
-- 第三部分：高级分析功能 (聚类/专题/验证/报告)
-- =====================================================

-- 1. 专题配置表 (Topic Configs)
CREATE TABLE topic_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    keywords JSON NOT NULL COMMENT '关键词数组',
    
    -- 作用域
    scope ENUM('global', 'country', 'app') NOT NULL DEFAULT 'global',
    country VARCHAR(10) DEFAULT NULL,
    app_id VARCHAR(100) DEFAULT NULL,
    
    is_active TINYINT(1) DEFAULT 1,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_scope (scope, country, app_id)
) ENGINE=InnoDB;

-- 2. 专题匹配记录表 (Topic Matches)
CREATE TABLE topic_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    review_id BIGINT NOT NULL COMMENT '关联 voc_feedbacks.id', 
    app_id VARCHAR(100) NOT NULL,
    country VARCHAR(10) NOT NULL,
    matched_keywords JSON,
    matched_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_topic_review (topic_id, review_id),
    INDEX idx_topic (topic_id),
    FOREIGN KEY (topic_id) REFERENCES topic_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (review_id) REFERENCES voc_feedbacks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. 专题分析结果表 (Topic Analysis)
CREATE TABLE topic_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    analysis_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    total_matches INT DEFAULT 0,
    sentiment_positive INT DEFAULT 0,
    sentiment_negative INT DEFAULT 0,
    sentiment_neutral INT DEFAULT 0,
    
    ai_summary TEXT,
    pain_points JSON,
    recommendations JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_topic_date (topic_id, analysis_date),
    FOREIGN KEY (topic_id) REFERENCES topic_configs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. 问题聚类表 (Issue Clusters)
CREATE TABLE issue_clusters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    week_number INT NOT NULL,
    year INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    cluster_title VARCHAR(200) NOT NULL,
    cluster_rank INT NOT NULL,
    review_count INT NOT NULL,
    percentage DECIMAL(5,2),
    
    review_ids JSON COMMENT '关联 voc_feedbacks.id 的列表',
    
    root_cause_summary TEXT,
    action_suggestion TEXT,
    sample_reviews JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_cluster (app_id, category, year, week_number, cluster_rank),
    INDEX idx_app_week (app_id, year, week_number)
) ENGINE=InnoDB;

-- 5. 闭环验证配置表 (Verification Configs)
CREATE TABLE verification_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(100) NOT NULL,
    
    issue_type ENUM('category', 'cluster', 'keyword') NOT NULL,
    issue_value VARCHAR(200) NOT NULL,
    
    baseline_start DATE NOT NULL,
    baseline_end DATE NOT NULL,
    
    verify_start DATE NOT NULL,
    verify_end DATE DEFAULT NULL,
    
    optimization_desc TEXT,
    expected_reduction DECIMAL(5,2),
    
    status ENUM('monitoring', 'resolved', 'worsened', 'no_change') DEFAULT 'monitoring',
    
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. 闭环验证结果表 (Verification Results)
CREATE TABLE verification_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_id INT NOT NULL,
    verify_date DATE NOT NULL,
    
    baseline_count INT NOT NULL,
    baseline_total INT NOT NULL,
    baseline_ratio DECIMAL(8,4),
    
    verify_count INT NOT NULL,
    verify_total INT NOT NULL,
    verify_ratio DECIMAL(8,4),
    
    count_change INT,
    ratio_change DECIMAL(8,4),
    change_percent DECIMAL(8,2),
    
    conclusion ENUM('resolved', 'improved', 'no_change', 'worsened') NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_id) REFERENCES verification_configs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. 报告存档表 (整合了高级字段)
CREATE TABLE reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    report_type VARCHAR(50) DEFAULT 'weekly',
    week_number INT,
    year INT,
    title VARCHAR(500),
    content LONGTEXT NOT NULL,
    
    -- 统计数据
    summary_stats JSON,
    compared_with_last JSON,
    total_issues INT DEFAULT 0,
    new_issues INT DEFAULT 0,
    resolved_issues INT DEFAULT 0,
    pending_issues INT DEFAULT 0,
    
    -- 高级分析摘要
    cluster_summary JSON,
    topic_summary JSON,
    verification_summary JSON,
    action_items JSON,
    
    generated_by INT,
    generated_by_name VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_app_id (app_id),
    INDEX idx_year_week (year, week_number)
) ENGINE=InnoDB;

-- 8. 状态变更日志
CREATE TABLE status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id BIGINT NOT NULL COMMENT '关联 voc_feedbacks.id',
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    user_id INT,
    user_name VARCHAR(100),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_review_id (review_id)
) ENGINE=InnoDB;

-- 9. 定时任务执行记录表
CREATE TABLE scheduled_task_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_type ENUM('cluster', 'topic_scan', 'verification', 'weekly_report') NOT NULL,
    app_id VARCHAR(100) DEFAULT NULL,
    status ENUM('running', 'success', 'failed') NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    items_processed INT DEFAULT 0,
    error_message TEXT,
    result_summary JSON
) ENGINE=InnoDB;