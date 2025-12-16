-- =====================================================
-- VOC 高级功能数据库设计
-- 功能1: 用户原声智能聚类
-- 功能2: 定向专题分析
-- 功能3: 闭环效果验证
-- 功能4: 周度自动报告
-- =====================================================

-- -----------------------------------------------------
-- 1. 专题配置表 (Topic Configs)
-- 支持 Global / Country / App 三层作用域
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS topic_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '专题名称，如"双十一活动"',
    description TEXT COMMENT '专题描述',
    keywords JSON NOT NULL COMMENT '关键词数组，如["人脸", "识别", "失败"]',
    
    -- 作用域：Global > Country > App (越具体优先级越高)
    scope ENUM('global', 'country', 'app') NOT NULL DEFAULT 'global',
    country VARCHAR(10) DEFAULT NULL COMMENT '国家代码，scope=country/app时必填',
    app_id VARCHAR(100) DEFAULT NULL COMMENT 'App ID，scope=app时必填',
    
    -- 状态控制
    is_active TINYINT(1) DEFAULT 1,
    start_date DATE DEFAULT NULL COMMENT '生效开始日期',
    end_date DATE DEFAULT NULL COMMENT '生效结束日期',
    
    -- 审计字段
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_scope (scope, country, app_id),
    INDEX idx_active (is_active, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 2. 专题匹配记录表 (Topic Matches)
-- 记录每条评论匹配到哪些专题
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS topic_matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    review_id VARCHAR(100) NOT NULL COMMENT '评论ID',
    app_id VARCHAR(100) NOT NULL,
    country VARCHAR(10) NOT NULL,
    matched_keywords JSON COMMENT '实际匹配到的关键词',
    matched_text TEXT COMMENT '匹配到的文本片段',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_topic_review (topic_id, review_id),
    INDEX idx_topic (topic_id),
    INDEX idx_review (review_id),
    INDEX idx_app_country (app_id, country),
    FOREIGN KEY (topic_id) REFERENCES topic_configs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 3. 专题分析结果表 (Topic Analysis)
-- 存储 AI 对专题的汇总分析
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS topic_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    analysis_date DATE NOT NULL COMMENT '分析日期',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- 统计数据
    total_matches INT DEFAULT 0,
    sentiment_positive INT DEFAULT 0,
    sentiment_negative INT DEFAULT 0,
    sentiment_neutral INT DEFAULT 0,
    
    -- AI 分析结果
    ai_summary TEXT COMMENT 'AI生成的摘要',
    pain_points JSON COMMENT '主要痛点列表',
    recommendations JSON COMMENT '改进建议',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_topic_date (topic_id, analysis_date),
    INDEX idx_topic (topic_id),
    FOREIGN KEY (topic_id) REFERENCES topic_configs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 4. 问题聚类表 (Issue Clusters)
-- 存储同类问题的聚类结果
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_clusters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(100) NOT NULL,
    country VARCHAR(10) DEFAULT NULL,
    category VARCHAR(50) NOT NULL COMMENT '问题分类，如Tech_Bug',
    
    -- 时间维度
    week_number INT NOT NULL,
    year INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- 聚类结果
    cluster_title VARCHAR(200) NOT NULL COMMENT '聚类标题，如"短信验证码收不到"',
    cluster_rank INT NOT NULL COMMENT '排名 1-N',
    review_count INT NOT NULL COMMENT '涉及评论数',
    percentage DECIMAL(5,2) COMMENT '占该分类总数的百分比',
    
    -- 关联的评论ID
    review_ids JSON COMMENT '属于该聚类的评论ID列表',
    
    -- AI 分析
    root_cause_summary TEXT COMMENT '根因汇总',
    action_suggestion TEXT COMMENT '行动建议',
    sample_reviews JSON COMMENT '代表性评论样本',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_cluster (app_id, category, year, week_number, cluster_rank),
    INDEX idx_app_week (app_id, year, week_number),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 5. 闭环验证配置表 (Verification Configs)
-- 配置需要跟踪验证的问题
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(100) NOT NULL,
    
    -- 验证目标
    issue_type ENUM('category', 'cluster', 'keyword') NOT NULL,
    issue_value VARCHAR(200) NOT NULL COMMENT '分类名/聚类ID/关键词',
    
    -- 基准期配置
    baseline_start DATE NOT NULL COMMENT '优化前起始日期',
    baseline_end DATE NOT NULL COMMENT '优化前结束日期',
    
    -- 验证期配置
    verify_start DATE NOT NULL COMMENT '优化后起始日期',
    verify_end DATE DEFAULT NULL COMMENT '优化后结束日期，NULL表示持续监控',
    
    -- 优化描述
    optimization_desc TEXT COMMENT '优化措施描述',
    expected_reduction DECIMAL(5,2) COMMENT '预期下降百分比',
    
    -- 状态
    status ENUM('monitoring', 'resolved', 'worsened', 'no_change') DEFAULT 'monitoring',
    
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_app (app_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 6. 闭环验证结果表 (Verification Results)
-- 存储每次验证的对比结果
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_id INT NOT NULL,
    verify_date DATE NOT NULL COMMENT '验证日期',
    
    -- 基准期数据
    baseline_count INT NOT NULL COMMENT '基准期问题数',
    baseline_total INT NOT NULL COMMENT '基准期总评论数',
    baseline_ratio DECIMAL(8,4) COMMENT '基准期占比',
    
    -- 验证期数据
    verify_count INT NOT NULL COMMENT '验证期问题数',
    verify_total INT NOT NULL COMMENT '验证期总评论数',
    verify_ratio DECIMAL(8,4) COMMENT '验证期占比',
    
    -- 变化计算
    count_change INT COMMENT '数量变化（负数表示下降）',
    ratio_change DECIMAL(8,4) COMMENT '占比变化',
    change_percent DECIMAL(8,2) COMMENT '变化百分比',
    
    -- 结论
    conclusion ENUM('resolved', 'improved', 'no_change', 'worsened') NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_config (config_id),
    INDEX idx_date (verify_date),
    FOREIGN KEY (config_id) REFERENCES verification_configs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 7. 周报存档表扩展（如果 reports 表已存在则用 ALTER）
-- 增加聚类、专题、验证结果的引用
-- -----------------------------------------------------
ALTER TABLE reports 
    ADD COLUMN cluster_summary JSON COMMENT '聚类结果摘要',
    ADD COLUMN topic_summary JSON COMMENT '专题追踪摘要',
    ADD COLUMN verification_summary JSON COMMENT '闭环验证摘要',
    ADD COLUMN action_items JSON COMMENT 'AI建议的行动项';

-- -----------------------------------------------------
-- 8. 定时任务执行记录表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_task_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_type ENUM('cluster', 'topic_scan', 'verification', 'weekly_report') NOT NULL,
    app_id VARCHAR(100) DEFAULT NULL,
    
    status ENUM('running', 'success', 'failed') NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    
    items_processed INT DEFAULT 0,
    error_message TEXT,
    result_summary JSON,
    
    INDEX idx_task_type (task_type, status),
    INDEX idx_app (app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
