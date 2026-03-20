-- BizLens v3.0 语义层数据模型
-- 适用于 PostgreSQL 16+

-- =====================================================
-- 1. 基础表：用户和组织
-- =====================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- admin, data-team, business
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 组织表
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. 数据源管理
-- =====================================================

-- 数据源表
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- mysql, postgresql, bigquery, snowflake, csv
    config JSONB NOT NULL, -- 连接配置（加密存储）
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, error
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 数据源表结构缓存
CREATE TABLE IF NOT EXISTS data_source_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255),
    columns JSONB NOT NULL, -- 列信息
    primary_keys TEXT[],
    row_count_estimate BIGINT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(data_source_id, table_name)
);

-- =====================================================
-- 3. 语义层核心表
-- =====================================================

-- 指标定义表
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    formula TEXT NOT NULL, -- SQL 表达式或计算逻辑
    base_tables TEXT[], -- 涉及的基础表
    dimensions TEXT[], -- 相关维度
    tags TEXT[],
    owner VARCHAR(100),
    format VARCHAR(50) DEFAULT 'number', -- number, percentage, currency, decimal
    aggregation VARCHAR(50) DEFAULT 'sum', -- sum, avg, count, min, max
    is_core BOOLEAN DEFAULT false, -- 是否核心指标
    git_path VARCHAR(500), -- Git 中的路径
    git_commit VARCHAR(40), -- Git commit hash
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(organization_id, name)
);

-- 维度定义表
CREATE TABLE IF NOT EXISTS dimensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    column_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    data_source_id UUID REFERENCES data_sources(id),
    data_type VARCHAR(50), -- string, number, date, datetime, geography
    hierarchy JSONB, -- 层次结构 {"parent": "province", "children": ["city"]}
    cardinality INTEGER, -- 唯一值数量
    sample_values TEXT[], -- 示例值
    tags TEXT[],
    git_path VARCHAR(500),
    git_commit VARCHAR(40),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(organization_id, name)
);

-- 业务关系表
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    source_table VARCHAR(100) NOT NULL,
    source_column VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100) NOT NULL,
    relationship_type VARCHAR(50), -- one-to-many, many-to-many, one-to-one
    join_type VARCHAR(50) DEFAULT 'left', -- left, right, inner, full
    conditions JSONB, -- 额外连接条件
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 业务规则表
CREATE TABLE IF NOT EXISTS business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50), -- filter, calculation, validation, alert
    condition TEXT NOT NULL, -- 条件表达式
    action TEXT, -- 执行动作
    priority INTEGER DEFAULT 0, -- 优先级
    is_active BOOLEAN DEFAULT true,
    applies_to_metrics TEXT[], -- 适用的指标
    applies_to_dimensions TEXT[], -- 适用的维度
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- =====================================================
-- 4. Notebook 相关表
-- =====================================================

-- Notebook 表
CREATE TABLE IF NOT EXISTS notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    git_path VARCHAR(500), -- Git 中的路径
    git_commit VARCHAR(40), -- 最新 commit
    cells JSONB DEFAULT '[]', -- 单元格内容 [{id, type, code, output, deps}]
    dag JSONB, -- 依赖图
    runtime_config JSONB, -- 运行时配置
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Notebook 版本历史
CREATE TABLE IF NOT EXISTS notebook_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    cells JSONB NOT NULL,
    commit_message TEXT,
    git_commit VARCHAR(40),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(notebook_id, version)
);

-- =====================================================
-- 5. Boards 相关表
-- =====================================================

-- 看板表
CREATE TABLE IF NOT EXISTS boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    notebook_id UUID REFERENCES notebooks(id), -- 来源 Notebook
    layout JSONB, -- 布局配置 {columns, rows, cards: [{id, type, config, position}]}
    cards JSONB, -- 卡片配置
    theme VARCHAR(50) DEFAULT 'default', -- 主题
    refresh_schedule VARCHAR(50), -- 刷新计划 (cron 表达式)
    last_refresh_at TIMESTAMPTZ,
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(64), -- 分享 token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 看板订阅
CREATE TABLE IF NOT EXISTS board_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    notification_channels TEXT[], -- [email, slack, dingtalk, feishu]
    notify_on_alert BOOLEAN DEFAULT true,
    notify_on_refresh BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(board_id, user_id)
);

-- =====================================================
-- 6. AI 相关表
-- =====================================================

-- AI 技能表
CREATE TABLE IF NOT EXISTS ai_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    triggers TEXT[], -- 触发关键词
    instructions TEXT NOT NULL, -- 执行指令 (prompt template)
    context_tables TEXT[], -- 需要的上下文表
    output_schema JSONB, -- 输出 schema 定义
    examples JSONB, -- 示例
    is_active BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2), -- 成功率
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(organization_id, name)
);

-- AI 技能执行日志
CREATE TABLE IF NOT EXISTS ai_skill_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES ai_skills(id),
    user_id UUID REFERENCES users(id),
    input TEXT, -- 用户输入
    output JSONB, -- AI 输出
    execution_time_ms INTEGER, -- 执行时间
    tokens_used INTEGER, -- 消耗的 token
    success BOOLEAN,
    feedback INTEGER, -- 用户反馈 1-5
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 查询历史表
CREATE TABLE IF NOT EXISTS query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    question TEXT NOT NULL,
    sql_query TEXT, -- 生成的 SQL
    result_schema JSONB, -- 结果 schema
    result_rows INTEGER, -- 结果行数
    execution_time_ms INTEGER, -- 执行时间
    ai_agent_logs JSONB, -- AI Agent 决策日志
    source VARCHAR(50), -- explore, notebook, board
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. 告警和监控表
-- =====================================================

-- 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_id UUID REFERENCES metrics(id),
    condition TEXT NOT NULL, -- 条件表达式 (e.g., "value > 1000")
    threshold JSONB, -- 阈值配置
    check_interval VARCHAR(50), -- 检查间隔 (cron)
    notification_channels TEXT[], -- 通知渠道
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 告警历史表
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES alert_rules(id),
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    value DECIMAL, -- 触发时的值
    threshold_value DECIMAL, -- 阈值
    message TEXT, -- 告警消息
    status VARCHAR(50) DEFAULT 'new', -- new, acknowledged, resolved
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id)
);

-- =====================================================
-- 8. 索引和约束
-- =====================================================

-- 指标索引
CREATE INDEX idx_metrics_org ON metrics(organization_id);
CREATE INDEX idx_metrics_name ON metrics(organization_id, name);
CREATE INDEX idx_metrics_tags ON metrics USING GIN(tags);
CREATE INDEX idx_metrics_core ON metrics(is_core) WHERE is_core = true;

-- 维度索引
CREATE INDEX idx_dimensions_org ON dimensions(organization_id);
CREATE INDEX idx_dimensions_name ON dimensions(organization_id, name);
CREATE INDEX idx_dimensions_type ON dimensions(data_type);

-- Notebook 索引
CREATE INDEX idx_notebooks_org ON notebooks(organization_id);
CREATE INDEX idx_notebooks_owner ON notebooks(owner_id);
CREATE INDEX idx_notebooks_public ON notebooks(is_public) WHERE is_public = true;

-- Board 索引
CREATE INDEX idx_boards_org ON boards(organization_id);
CREATE INDEX idx_boards_owner ON boards(owner_id);
CREATE INDEX idx_boards_public ON boards(is_public) WHERE is_public = true;

-- 查询历史索引
CREATE INDEX idx_query_history_org ON query_history(organization_id);
CREATE INDEX idx_query_history_user ON query_history(user_id);
CREATE INDEX idx_query_history_created ON query_history(created_at DESC);

-- 告警索引
CREATE INDEX idx_alert_rules_org ON alert_rules(organization_id);
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_alert_history_rule ON alert_history(rule_id);
CREATE INDEX idx_alert_history_status ON alert_history(status) WHERE status = 'new';

-- =====================================================
-- 9. 视图和函数
-- =====================================================

-- 核心指标视图
CREATE OR REPLACE VIEW core_metrics AS
SELECT 
    m.id,
    m.name,
    m.display_name,
    m.description,
    m.formula,
    m.format,
    m.aggregation,
    m.owner,
    m.created_at,
    COUNT(DISTINCT n.id) as used_in_notebooks,
    COUNT(DISTINCT b.id) as used_in_boards
FROM metrics m
LEFT JOIN notebooks n ON m.organization_id = n.organization_id
LEFT JOIN boards b ON m.organization_id = b.organization_id
WHERE m.is_core = true AND m.deleted_at IS NULL
GROUP BY m.id;

-- 热门查询视图
CREATE OR REPLACE VIEW popular_queries AS
SELECT 
    question,
    COUNT(*) as usage_count,
    AVG(execution_time_ms) as avg_execution_time,
    MAX(created_at) as last_used
FROM query_history
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY question
ORDER BY usage_count DESC
LIMIT 100;

-- =====================================================
-- 10. 初始数据
-- =====================================================

-- 插入示例组织
INSERT INTO organizations (id, name) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Default Organization')
ON CONFLICT (id) DO NOTHING;

-- 插入示例核心指标
INSERT INTO metrics (organization_id, name, display_name, description, formula, base_tables, format, aggregation, is_core) VALUES
    ('00000000-0000-0000-0000-000000000001', 'gmv', 'GMV', '成交总额', 'SUM(amount)', ARRAY['orders'], 'currency', 'sum', true),
    ('00000000-0000-0000-0000-000000000001', 'order_count', '订单量', '订单总数', 'COUNT(*)', ARRAY['orders'], 'number', 'count', true),
    ('00000000-0000-0000-0000-000000000001', 'revenue', '收入', '实际收入', 'SUM(paid_amount)', ARRAY['orders'], 'currency', 'sum', true),
    ('00000000-0000-0000-0000-000000000001', 'conversion_rate', '转化率', '访问到下单转化率', 'COUNT(DISTINCT order_id) / COUNT(DISTINCT visitor_id) * 100', ARRAY['orders', 'visitors'], 'percentage', 'avg', true)
ON CONFLICT (organization_id, name) DO NOTHING;

-- 插入示例维度
INSERT INTO dimensions (organization_id, name, display_name, description, column_name, table_name, data_type) VALUES
    ('00000000-0000-0000-0000-000000000001', 'date', '日期', '按日期分组', 'DATE(created_at)', 'orders', 'date'),
    ('00000000-0000-0000-0000-000000000001', 'province', '省份', '按省份分组', 'province', 'orders', 'string'),
    ('00000000-0000-0000-0000-000000000001', 'category', '品类', '按品类分组', 'category', 'order_items', 'string')
ON CONFLICT (organization_id, name) DO NOTHING;

-- =====================================================
-- 注释
-- =====================================================

COMMENT ON TABLE metrics IS '指标定义表 - 存储业务指标的计算逻辑和元数据';
COMMENT ON TABLE dimensions IS '维度定义表 - 存储分析维度的定义';
COMMENT ON TABLE relationships IS '业务关系表 - 存储表之间的关联关系';
COMMENT ON TABLE notebooks IS 'Notebook 表 - 存储响应式分析本';
COMMENT ON TABLE boards IS '看板表 - 存储数据看板配置';
COMMENT ON TABLE ai_skills IS 'AI 技能表 - 存储可复用的 AI 分析技能';
