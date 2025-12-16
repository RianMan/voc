-- VOC MySQL 数据库初始化脚本
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS voc_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE voc_db;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL
) ENGINE=InnoDB;

-- 评论状态表
CREATE TABLE IF NOT EXISTS review_status (
    review_id VARCHAR(255) PRIMARY KEY,
    source VARCHAR(50) DEFAULT 'google_play',
    status ENUM('pending', 'irrelevant', 'confirmed', 'reported', 'in_progress', 'resolved') DEFAULT 'pending',
    assignee VARCHAR(100),
    note TEXT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_source (source)
) ENGINE=InnoDB;

-- 状态变更日志
CREATE TABLE IF NOT EXISTS status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id VARCHAR(255) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    user_id INT,
    user_name VARCHAR(100),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_review_id (review_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- 问题备注表
CREATE TABLE IF NOT EXISTS review_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(100),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_review_id (review_id)
) ENGINE=InnoDB;

-- 报告存档表
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    report_type VARCHAR(50) DEFAULT 'weekly',
    week_number INT,
    year INT,
    title VARCHAR(500),
    content LONGTEXT NOT NULL,
    summary_stats JSON,
    compared_with_last JSON,
    total_issues INT DEFAULT 0,
    new_issues INT DEFAULT 0,
    resolved_issues INT DEFAULT 0,
    pending_issues INT DEFAULT 0,
    generated_by INT,
    generated_by_name VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_app_id (app_id),
    INDEX idx_year_week (year, week_number)
) ENGINE=InnoDB;

-- 邮件订阅配置表
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_app_email (app_id, email)
) ENGINE=InnoDB;

-- App配置表
CREATE TABLE IF NOT EXISTS app_configs (
    app_id VARCHAR(255) PRIMARY KEY,
    app_name VARCHAR(255) NOT NULL,
    country VARCHAR(10),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- AI费用记录表
CREATE TABLE IF NOT EXISTS ai_costs (
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

-- ============================================
-- 以下是为未来 Udesk 对话扩展预留的表结构
-- ============================================

-- 对话记录主表（支持多渠道：GP评论、Udesk文字、Udesk语音等）
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL,           -- 外部ID（GP review_id / Udesk conversation_id）
    source ENUM('google_play', 'udesk_chat', 'udesk_voice', 'email', 'other') NOT NULL,
    app_id VARCHAR(255),
    app_name VARCHAR(255),
    country VARCHAR(10),
    
    -- 用户信息
    customer_id VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- 内容（支持长文本）
    content LONGTEXT,                            -- 原始内容/转写文本
    translated_content LONGTEXT,                 -- 翻译后内容
    
    -- 元数据
    duration_seconds INT,                        -- 语音通话时长
    message_count INT,                           -- 对话消息数
    
    -- AI分析结果
    category VARCHAR(50),
    risk_level ENUM('High', 'Medium', 'Low'),
    summary TEXT,
    root_cause TEXT,
    action_advice TEXT,
    suggested_reply TEXT,
    sentiment_score DECIMAL(3, 2),               -- 情感分数 -1 到 1
    
    -- 状态
    status ENUM('pending', 'irrelevant', 'confirmed', 'reported', 'in_progress', 'resolved') DEFAULT 'pending',
    assignee VARCHAR(100),
    
    -- 时间
    conversation_time DATETIME,                  -- 对话发生时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_source_external (source, external_id),
    INDEX idx_app_id (app_id),
    INDEX idx_source (source),
    INDEX idx_status (status),
    INDEX idx_risk_level (risk_level),
    INDEX idx_conversation_time (conversation_time),
    FULLTEXT INDEX ft_content (content, translated_content, summary)
) ENGINE=InnoDB;

-- 对话消息明细表（用于存储Udesk多轮对话）
CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sequence_num INT NOT NULL,                   -- 消息序号
    role ENUM('customer', 'agent', 'system') NOT NULL,
    content TEXT NOT NULL,
    content_type ENUM('text', 'image', 'audio', 'file') DEFAULT 'text',
    file_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversation_id (conversation_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 语音通话附加信息表
CREATE TABLE IF NOT EXISTS voice_call_details (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL UNIQUE,
    call_id VARCHAR(255),
    agent_id VARCHAR(100),
    agent_name VARCHAR(100),
    queue_name VARCHAR(100),
    wait_seconds INT,
    talk_seconds INT,
    audio_url VARCHAR(500),
    transcription_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    transcription_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;
