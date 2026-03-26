package model

import (
	"time"

	"gorm.io/gorm"
)

// Tenant 租户（SaaS 多租户）
type Tenant struct {
	ID        string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	Name      string         `gorm:"size:200;not null" json:"name"`
	Plan      string         `gorm:"size:50;default:'free'" json:"plan"` // free / pro / enterprise
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// User 用户
type User struct {
	ID            string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID      string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Name          string         `gorm:"size:100;not null" json:"name"`
	Email         string         `gorm:"size:200;not null;uniqueIndex" json:"email"`
	PasswordHash  string         `gorm:"size:500;not null" json:"-"`           // 密码哈希
	Role          string         `gorm:"size:50;default:'member'" json:"role"` // owner / admin / member
	LastLoginAt   *time.Time     `json:"lastLoginAt,omitempty"`                // 最后登录时间
	LoginAttempts int            `gorm:"default:0" json:"-"`                   // 登录失败次数
	LockedUntil   *time.Time     `json:"lockedUntil,omitempty"`                // 锁定截止时间
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// IMPlatformType IM 平台类型
type IMPlatformType string

const (
	IMPlatformDingtalk IMPlatformType = "dingtalk"
	IMPlatformFeishu   IMPlatformType = "feishu"
	IMPlatformWecom    IMPlatformType = "wecom"
	IMPlatformSlack    IMPlatformType = "slack"
	IMPlatformTelegram IMPlatformType = "telegram"
	IMPlatformDiscord  IMPlatformType = "discord"
)

// IMConnectionStatus 连接状态
type IMConnectionStatus string

const (
	IMStatusConnected    IMConnectionStatus = "connected"
	IMStatusDisconnected IMConnectionStatus = "disconnected"
	IMStatusError        IMConnectionStatus = "error"
)

// IMConfig IM 平台配置
type IMConfig struct {
	ID         string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID   string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Type       IMPlatformType `gorm:"size:50;not null" json:"type"`
	Name       string         `gorm:"size:200;not null" json:"name"`
	Enabled    bool           `gorm:"default:true" json:"enabled"`
	WebhookURL string         `gorm:"size:500;not null" json:"webhookUrl"`
	Secret     string         `gorm:"size:500" json:"secret,omitempty"`
	// Keyword 钉钉自定义机器人「安全设置-自定义关键词」中配置的关键词；发送内容需包含该词，否则钉钉返回 errcode 310000
	Keyword   string             `gorm:"size:100" json:"keyword,omitempty"`
	Status    IMConnectionStatus `gorm:"size:50;default:'disconnected'" json:"status"`
	CreatedAt time.Time          `json:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt"`
	DeletedAt gorm.DeletedAt     `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// NotificationStatus 通知状态
type NotificationStatus string

const (
	NotifyPending NotificationStatus = "pending"
	NotifySent    NotificationStatus = "sent"
	NotifyFailed  NotificationStatus = "failed"
)

// NotificationRecord 通知记录
type NotificationRecord struct {
	ID           string             `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string             `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	PlatformID   string             `gorm:"type:varchar(50);not null;index" json:"platformId"`
	PlatformType IMPlatformType     `gorm:"size:50;not null" json:"platformType"`
	Title        string             `gorm:"size:500" json:"title"`
	Content      string             `gorm:"type:text;not null" json:"content"`
	Markdown     bool               `gorm:"default:false" json:"markdown"`
	Status       NotificationStatus `gorm:"size:50;default:'pending'" json:"status"`
	Error        string             `gorm:"type:text" json:"error,omitempty"`
	SentAt       *time.Time         `json:"sentAt,omitempty"`
	CreatedAt    time.Time          `json:"createdAt"`

	IMConfig IMConfig `gorm:"foreignKey:PlatformID" json:"-"`
	Tenant   Tenant   `gorm:"foreignKey:TenantID" json:"-"`
}

// AlertConditionType 告警条件类型
type AlertConditionType string

const (
	AlertCondGreater AlertConditionType = "greater"
	AlertCondLess    AlertConditionType = "less"
	AlertCondEquals  AlertConditionType = "equals"
	AlertCondChange  AlertConditionType = "change"
	AlertCondCustom  AlertConditionType = "custom"
)

// AlertEvent 告警事件配置
type AlertEvent struct {
	ID            string             `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID      string             `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Name          string             `gorm:"size:200;not null" json:"name"`
	Description   string             `gorm:"size:500" json:"description"`
	Enabled       bool               `gorm:"default:true" json:"enabled"`
	Metric        string             `gorm:"size:100;not null" json:"metric"`
	ConditionType AlertConditionType `gorm:"size:50;not null" json:"conditionType"`
	Threshold     float64            `json:"threshold"`
	Message       string             `gorm:"type:text;not null" json:"message"`
	PlatformIDs   string             `gorm:"size:500" json:"platformIds"`
	CreatedAt     time.Time          `json:"createdAt"`
	UpdatedAt     time.Time          `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt     `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// AlertTriggerLog 告警触发记录
type AlertTriggerLog struct {
	ID          string    `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string    `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	EventID     string    `gorm:"type:varchar(50);not null;index" json:"eventId"`
	EventName   string    `gorm:"size:200" json:"eventName"`
	Metric      string    `gorm:"size:100;not null" json:"metric"`
	ActualValue float64   `json:"actualValue"`
	Threshold   float64   `json:"threshold"`
	Message     string    `gorm:"type:text" json:"message"`
	Status      string    `gorm:"size:50;default:'sent'" json:"status"`
	Error       string    `gorm:"type:text" json:"error,omitempty"`
	SourceType  string    `gorm:"size:50;default:'quick_alert'" json:"sourceType"` // quick_alert / auto_rule
	TriggeredAt time.Time `json:"triggeredAt"`
	CreatedAt   time.Time `json:"createdAt"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// ChatConversation 对话会话
type ChatConversation struct {
	ID            string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID      string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	UserID        string         `gorm:"type:varchar(50);not null;index" json:"userId"`
	Title         string         `gorm:"size:200;not null;default:'新对话'" json:"title"`
	LastMessageAt *time.Time     `json:"lastMessageAt,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Messages []ChatConversationMessage `gorm:"foreignKey:ConversationID" json:"messages,omitempty"`
}

// ChatConversationMessage 对话消息
type ChatConversationMessage struct {
	ID             string    `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	ConversationID string    `gorm:"type:varchar(50);not null;index" json:"conversationId"`
	TenantID       string    `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Role           string    `gorm:"size:20;not null" json:"role"`
	Content        string    `gorm:"type:text;not null" json:"content"`
	Files          string    `gorm:"type:text" json:"files,omitempty"`
	OccurredAt     time.Time `gorm:"index" json:"occurredAt"`
	SortOrder      int       `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`

	Conversation ChatConversation `gorm:"foreignKey:ConversationID" json:"-"`
}

// DataSourceType 数据源类型
type DataSourceType string

const (
	DataSourceMySQL      DataSourceType = "mysql"
	DataSourcePostgreSQL DataSourceType = "postgresql"
	DataSourceSQLite     DataSourceType = "sqlite"
	DataSourceCSV        DataSourceType = "csv"
	DataSourceExcel      DataSourceType = "excel"
	DataSourceAPI        DataSourceType = "api"
	DataSourceOther      DataSourceType = "other"
)

// DataSourceStatus 数据源状态
type DataSourceStatus string

const (
	DSStatusConnected    DataSourceStatus = "connected"
	DSStatusDisconnected DataSourceStatus = "disconnected"
	DSStatusError        DataSourceStatus = "error"
)

// DataSource 数据源配置
type DataSource struct {
	ID          string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Type        DataSourceType `gorm:"size:50;not null" json:"type"`
	Name        string         `gorm:"size:200;not null" json:"name"`
	Description string         `gorm:"size:500" json:"description"`
	// 数据库连接配置（加密存储）
	Host     string `gorm:"size:200" json:"host,omitempty"`
	Port     int    `json:"port,omitempty"`
	Database string `gorm:"size:200" json:"database,omitempty"`
	Username string `gorm:"size:200" json:"username,omitempty"`
	Password string `gorm:"size:500" json:"password,omitempty"`
	SSL      bool   `gorm:"default:false" json:"ssl,omitempty"`
	// API 数据源配置
	APIURL     string `gorm:"size:500" json:"apiUrl,omitempty"`
	APIMethod  string `gorm:"size:20;default:'GET'" json:"apiMethod,omitempty"`
	APIHeaders string `gorm:"type:text" json:"apiHeaders,omitempty"` // JSON 字符串
	APIToken   string `gorm:"size:500" json:"apiToken,omitempty"`
	// 文件数据源
	FileName  string `gorm:"size:200" json:"fileName,omitempty"`
	FileSize  int64  `json:"fileSize,omitempty"`
	FilePath  string `gorm:"size:500" json:"filePath,omitempty"`
	TableInfo string `gorm:"type:text" json:"tableInfo,omitempty"` // JSON 字符串，存储表结构
	// 状态
	Status      DataSourceStatus `gorm:"size:50;default:'disconnected'" json:"status"`
	LastSyncAt  *time.Time       `json:"lastSyncAt,omitempty"`
	SyncMessage string           `gorm:"type:text" json:"syncMessage,omitempty"`
	CreatedAt   time.Time        `json:"createdAt"`
	UpdatedAt   time.Time        `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt   `gorm:"index" json:"-"`
	SchemaInfo  string           `gorm:"type:text" json:"schemaInfo,omitempty"` // JSON 字符串，存储 schema 信息
	AIAnalysis  string           `gorm:"type:text" json:"aiAnalysis,omitempty"` // AI 分析结果（字段语义标签、推荐指标、推荐维度等）

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// FieldSemanticAI AI 对单个字段的语义分析结果
type FieldSemanticAI struct {
	Field        string   `json:"field"`                  // 字段名
	Table        string   `json:"table"`                  // 表名
	SemanticType string   `json:"semanticType"`           // 语义类型: metric/dimension/time/geo/category/technical/identifier/unknown
	SubType      string   `json:"subType,omitempty"`      // 子类型: amount/count/ratio/time/...
	BusinessName string   `json:"businessName,omitempty"` // AI 推荐的中文业务名称
	Aggregation  string   `json:"aggregation,omitempty"`  // 推荐聚合方式: SUM/COUNT/AVG/MAX/MIN/COUNT(DISTINCT)
	Confidence   float64  `json:"confidence"`             // 置信度 0-1
	Reason       string   `json:"reason,omitempty"`       // 判断理由
	Tags         []string `json:"tags,omitempty"`         // 标签: key_metric/time_series/discrete/continuous/...
}

// TableSemanticAI AI 对单个表的语义分析结果
type TableSemanticAI struct {
	Table        string   `json:"table"`               // 表名
	BusinessType string   `json:"businessType"`        // 业务类型: fact/dimension/mapping/transaction/log/unknown
	Summary      string   `json:"summary,omitempty"`   // 表的业务概述
	IsPrimary    bool     `json:"isPrimary,omitempty"` // 是否主表（包含核心业务事件）
	Confidence   float64  `json:"confidence"`
	Reason       string   `json:"reason,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

// SchemaAIAnalysis 完整的 schema AI 分析结果（存储在 DataSource.AIAnalysis 中）
type SchemaAIAnalysis struct {
	AnalyzedAt      string                    `json:"analyzedAt"`                // 分析时间
	ModelUsed       string                    `json:"modelUsed"`                 // 使用的 AI 模型
	Fields          []FieldSemanticAI         `json:"fields"`                    // 字段级分析
	Tables          []TableSemanticAI         `json:"tables"`                    // 表级分析
	Recommendations []MetricRecommendation    `json:"recommendations,omitempty"` // 推荐发现的指标
	Dimensions      []DimensionRecommendation `json:"dimensions,omitempty"`      // 推荐发现的维度
}

// MetricRecommendation AI 推荐的指标
type MetricRecommendation struct {
	Table       string  `json:"table"`
	Field       string  `json:"field"`
	DisplayName string  `json:"displayName"` // 中文展示名
	DataType    string  `json:"dataType"`    // number/currency/ratio/composite
	Aggregation string  `json:"aggregation"` // SUM/COUNT/AVG/MAX/MIN/COUNT_DISTINCT/COMPOSITE
	Confidence  float64 `json:"confidence"`
	Reason      string  `json:"reason,omitempty"`
	// 复合指标专用字段
	IsComposite  bool     `json:"isComposite,omitempty"`  // 是否为复合指标
	Formula      string   `json:"formula,omitempty"`      // 计算公式（如 "SUM(amount) / COUNT(DISTINCT user_id)"）
	Dependencies []string `json:"dependencies,omitempty"` // 依赖的字段（如 ["orders.amount", "orders.user_id"]）
}

// DimensionRecommendation AI 推荐的维度
type DimensionRecommendation struct {
	Table       string  `json:"table"`
	Field       string  `json:"field"`
	DisplayName string  `json:"displayName"`
	DimType     string  `json:"dimType"` // time/geo/category/identifier
	Confidence  float64 `json:"confidence"`
	Reason      string  `json:"reason,omitempty"`
}

// NotificationRuleType 通知规则类型
type NotificationRuleType string

const (
	// RuleTypeDataThreshold 数据阈值触发（如销售额>1000）
	RuleTypeDataThreshold NotificationRuleType = "data_threshold"
	// RuleTypeDataChange 数据变化触发（如环比增长>20%）
	RuleTypeDataChange NotificationRuleType = "data_change"
	// RuleTypeScheduled 定时触发（如每日 9 点发送日报）
	RuleTypeScheduled NotificationRuleType = "scheduled"
	// RuleTypeCustom 自定义 SQL 条件触发
	RuleTypeCustom NotificationRuleType = "custom"
)

// NotificationFrequency 通知频率
type NotificationFrequency string

const (
	FreqOnce     NotificationFrequency = "once"     // 仅触发一次
	FreqHourly   NotificationFrequency = "hourly"   // 每小时
	FreqDaily    NotificationFrequency = "daily"    // 每天
	FreqWeekly   NotificationFrequency = "weekly"   // 每周
	FreqMonthly  NotificationFrequency = "monthly"  // 每月
	FreqRealtime NotificationFrequency = "realtime" // 实时（每次满足条件都触发）
)

// NotificationRule 通知规则配置（支持自然语言配置）
type NotificationRule struct {
	ID          string                `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string                `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Name        string                `gorm:"size:200;not null" json:"name"`           // 规则名称（如"销售额破千通知"）
	Description string                `gorm:"size:500" json:"description"`             // 规则描述
	Enabled     bool                  `gorm:"default:true" json:"enabled"`             // 是否启用
	RuleType    NotificationRuleType  `gorm:"size:50;not null" json:"ruleType"`        // 规则类型
	Frequency   NotificationFrequency `gorm:"size:50;default:'once'" json:"frequency"` // 通知频率

	// 数据源配置
	DataSourceID   string `gorm:"type:varchar(50)" json:"dataSourceId,omitempty"` // 数据源 ID
	TableName      string `gorm:"size:200" json:"tableName,omitempty"`            // 表名
	MetricField    string `gorm:"size:100" json:"metricField,omitempty"`          // 指标字段名（如"sales_amount"）
	DimensionField string `gorm:"size:100" json:"dimensionField,omitempty"`       // 维度字段名（如"date"）

	// 触发条件
	ConditionType AlertConditionType `gorm:"size:50" json:"conditionType"`             // 条件类型
	Threshold     float64            `json:"threshold,omitempty"`                      // 阈值
	ConditionExpr string             `gorm:"type:text" json:"conditionExpr,omitempty"` // 自定义条件表达式（SQL WHERE 子句）

	// 时间配置
	ScheduleTime string `gorm:"size:50" json:"scheduleTime,omitempty"` // 定时时间（如"09:00"或"MON 09:00"）
	TimeRange    string `gorm:"size:100" json:"timeRange,omitempty"`   // 时间范围（如"today"、"yesterday"、"last_7_days"）

	// 通知内容
	MessageTemplate string `gorm:"type:text" json:"messageTemplate,omitempty"` // 消息模板（支持变量占位符）
	MessageTitle    string `gorm:"size:500" json:"messageTitle,omitempty"`     // 消息标题

	// 通知目标
	PlatformIDs string `gorm:"size:500" json:"platformIds,omitempty"` // IM 平台 IDs（逗号分隔）
	WebhookURL  string `gorm:"size:500" json:"webhookUrl,omitempty"`  // 自定义 Webhook URL

	// 元数据
	NLQuery   string         `gorm:"type:text" json:"nlQuery,omitempty"` // 原始自然语言查询（用户输入）
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// MetricDataType 指标数据类型
type MetricDataType string

const (
	MetricTypeCurrency   MetricDataType = "currency"   // 金额
	MetricTypeNumber     MetricDataType = "number"     // 数字
	MetricTypePercentage MetricDataType = "percentage" // 百分比
	MetricTypeDateTime   MetricDataType = "datetime"   // 日期时间
	MetricTypeString     MetricDataType = "string"     // 字符串
)

// MetricAggregation 指标聚合方式
type MetricAggregation string

const (
	AggSum      MetricAggregation = "sum"
	AggCount    MetricAggregation = "count"
	AggAvg      MetricAggregation = "avg"
	AggMin      MetricAggregation = "min"
	AggMax      MetricAggregation = "max"
	AggDistinct MetricAggregation = "distinct_count"
	AggCustom   MetricAggregation = "custom" // 自定义公式
)

// Metric 业务指标（语义层核心）
type Metric struct {
	ID               string            `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID         string            `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	DataSourceID     string            `gorm:"type:varchar(50);not null;index" json:"dataSourceId"`
	Name             string            `gorm:"size:100;not null" json:"name"`          // 指标名称（如"GMV"）
	DisplayName      string            `gorm:"size:200" json:"displayName"`            // 显示名称（如"成交总额"）
	Description      string            `gorm:"size:500" json:"description"`            // 描述
	DataType         MetricDataType    `gorm:"size:50;not null" json:"dataType"`       // 数据类型
	Aggregation      MetricAggregation `gorm:"size:50;not null" json:"aggregation"`    // 聚合方式
	Formula          string            `gorm:"type:text;not null" json:"formula"`      // 计算公式（如"SUM(orders.amount)"）
	BaseTable        string            `gorm:"size:200" json:"baseTable"`              // 基础表名
	BaseField        string            `gorm:"size:200" json:"baseField"`              // 基础字段
	DependentMetrics string            `gorm:"type:text" json:"dependentMetrics"`      // 依赖的其他指标（JSON 数组）
	Tags             string            `gorm:"size:500" json:"tags"`                   // 标签（JSON 数组，如["销售","核心指标"]）
	Category         string            `gorm:"size:100" json:"category"`               // 分类（如"销售"、"用户"）
	IsAutoDetected   bool              `gorm:"default:false" json:"isAutoDetected"`    // 是否 AI 自动发现
	ConfidenceScore  float64           `gorm:"default:0.5" json:"confidenceScore"`     // 置信度（自动发现时使用）
	Status           string            `gorm:"size:50;default:'active'" json:"status"` // active/inactive/draft
	CreatedBy        string            `gorm:"type:varchar(50)" json:"createdBy"`      // 创建人 ID
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt    `gorm:"index" json:"-"`

	Tenant     Tenant     `gorm:"foreignKey:TenantID" json:"-"`
	DataSource DataSource `gorm:"foreignKey:DataSourceID" json:"-"`
}

// MetricLineage 指标血缘（追踪指标来源和使用）
type MetricLineage struct {
	ID           string     `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string     `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	MetricID     string     `gorm:"type:varchar(50);not null;index" json:"metricId"`
	SourceType   string     `gorm:"size:50;not null" json:"sourceType"` // table/column/metric
	SourceID     string     `gorm:"type:varchar(50)" json:"sourceId"`   // 来源 ID（表名/字段/指标 ID）
	SourceDetail string     `gorm:"type:text" json:"sourceDetail"`      // 来源详情（JSON）
	UsageCount   int        `gorm:"default:0" json:"usageCount"`        // 被引用次数
	LastUsedAt   *time.Time `json:"lastUsedAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
	Metric Metric `gorm:"foreignKey:MetricID" json:"-"`
}

// DimensionType 维度类型
type DimensionType string

const (
	DimTypeTime     DimensionType = "time"     // 时间维度
	DimTypeCategory DimensionType = "category" // 分类维度
	DimTypeGeo      DimensionType = "geo"      // 地理维度
	DimTypeCustom   DimensionType = "custom"   // 自定义维度
)

// Dimension 业务维度
type Dimension struct {
	ID             string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID       string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Name           string         `gorm:"size:100;not null" json:"name"`          // 维度名称（如"province"）
	DisplayName    string         `gorm:"size:200" json:"displayName"`            // 显示名称（如"省份"）
	Description    string         `gorm:"size:500" json:"description"`            // 描述
	DataType       DimensionType  `gorm:"size:50;not null" json:"dataType"`       // 维度类型
	BaseTable      string         `gorm:"size:200;not null" json:"baseTable"`     // 基础表名
	BaseField      string         `gorm:"size:200;not null" json:"baseField"`     // 基础字段
	PreValues      string         `gorm:"type:text" json:"preValues"`             // 预估值（JSON 数组，用于快速筛选）
	IsAutoDetected bool           `gorm:"default:false" json:"isAutoDetected"`    // 是否 AI 自动发现
	Tags           string         `gorm:"size:500" json:"tags"`                   // 标签
	Category       string         `gorm:"size:100" json:"category"`               // 分类
	Status         string         `gorm:"size:50;default:'active'" json:"status"` // active/inactive
	CreatedBy      string         `gorm:"type:varchar(50)" json:"createdBy"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// RelationshipType 关系类型
type RelationshipType string

const (
	RelOneToOne   RelationshipType = "one_to_one"
	RelOneToMany  RelationshipType = "one_to_many"
	RelManyToOne  RelationshipType = "many_to_one"
	RelManyToMany RelationshipType = "many_to_many"
)

// Relationship 表关系（用于跨表查询）
type Relationship struct {
	ID              string           `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID        string           `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Name            string           `gorm:"size:200;not null" json:"name"`          // 关系名称（如"订单 - 用户"）
	Description     string           `gorm:"size:500" json:"description"`            // 描述
	SourceType      string           `gorm:"size:50;not null" json:"sourceType"`     // 源表类型（table/metric）
	SourceTable     string           `gorm:"size:200;not null" json:"sourceTable"`   // 源表名
	TargetTable     string           `gorm:"size:200;not null" json:"targetTable"`   // 目标表名
	Relationship    RelationshipType `gorm:"size:50;not null" json:"relationship"`   // 关系类型
	JoinKey         string           `gorm:"size:200;not null" json:"joinKey"`       // 连接键（如"user_id"）
	TargetKey       string           `gorm:"size:200;not null" json:"targetKey"`     // 目标连接键（如"id"）
	IsAutoDetected  bool             `gorm:"default:false" json:"isAutoDetected"`    // 是否 AI 自动发现
	ConfidenceScore float64          `gorm:"default:0.5" json:"confidenceScore"`     // 置信度
	Status          string           `gorm:"size:50;default:'active'" json:"status"` // active/inactive
	CreatedBy       string           `gorm:"type:varchar(50)" json:"createdBy"`
	CreatedAt       time.Time        `json:"createdAt"`
	UpdatedAt       time.Time        `json:"updatedAt"`
	DeletedAt       gorm.DeletedAt   `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// DashboardSectionType 已迁移至 section_type.go（统一枚举，报表和大屏共用）

// DashboardSection 大屏区块配置
type DashboardSection struct {
	ID          string               `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string               `gorm:"type:varchar(50);index" json:"tenantId"`   // 可为空，系统模板的区块无 tenantID
	TemplateID  string               `gorm:"type:varchar(50);index" json:"templateId"` // 关联的模板 ID
	InstanceID  string               `gorm:"type:varchar(50);index" json:"instanceId"` // 关联的实例 ID
	Type        DashboardSectionType `gorm:"size:50;not null" json:"type"`             // kpi/trend/ranking/map/pie/bar/line/area/funnel/table/insight/alert/custom
	Title       string               `gorm:"size:200" json:"title"`                    // 区块标题
	Metrics     string               `gorm:"type:text" json:"metrics"`                 // 关联的指标（JSON 数组）
	Dimensions  string               `gorm:"type:text" json:"dimensions"`              // 关联的维度（JSON 数组）
	ChartConfig string               `gorm:"type:text" json:"chartConfig"`             // 图表配置（JSON 对象）
	// 布局配置
	Row      int `gorm:"default:0" json:"row"`      // 所在行（从 0 开始）
	Col      int `gorm:"default:0" json:"col"`      // 所在列（从 0 开始）
	Width    int `gorm:"default:1" json:"width"`    // 宽度（占几列，默认 1）
	Height   int `gorm:"default:1" json:"height"`   // 高度（占几行，默认 1）
	Priority int `gorm:"default:0" json:"priority"` // 优先级（数字越小越优先）
	// 数据配置
	TimeGrain  string `gorm:"size:50" json:"timeGrain"`    // 时间粒度（hour/day/week/month）
	TopN       int    `json:"topN"`                        // 排行 TopN
	Comparison string `gorm:"size:50" json:"comparison"`   // 对比维度（yesterday/lastWeek/lastMonth）
	SplitBy    string `gorm:"size:100" json:"splitBy"`     // 拆分维度
	FilterExpr string `gorm:"type:text" json:"filterExpr"` // 过滤条件表达式
	// AI 配置
	AutoGenerate bool `gorm:"default:false" json:"autoGenerate"` // 是否 AI 自动生成
	// 元数据
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// DashboardTemplate 大屏模板（故事模板）
type DashboardTemplate struct {
	ID          string `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string `gorm:"type:varchar(50);index" json:"tenantId"` // 为空表示系统预置模板
	Name        string `gorm:"size:200;not null" json:"name"`          // 模板名称（如"大促作战大屏"）
	Description string `gorm:"type:text" json:"description"`           // 模板描述
	Category    string `gorm:"size:100;not null" json:"category"`      // 分类（如"sales"/"operations"/"finance"）
	Icon        string `gorm:"size:100" json:"icon"`                   // 图标
	IsSystem    bool   `gorm:"default:false" json:"isSystem"`          // 是否系统预置
	IsPublic    bool   `gorm:"default:false" json:"isPublic"`          // 是否公开
	Tags        string `gorm:"size:500" json:"tags"`                   // 标签（JSON 数组）
	// 布局配置
	LayoutConfig string `gorm:"type:text" json:"layoutConfig"` // 整体布局配置（JSON）
	// 配色配置
	ColorPalette string `gorm:"type:text" json:"colorPalette"` // 配色方案（JSON）
	BrandColor   string `gorm:"size:50" json:"brandColor"`     // 品牌主色
	Industry     string `gorm:"size:100" json:"industry"`      // 适用行业
	ColorTone    string `gorm:"size:50" json:"colorTone"`      // 色调（professional/vibrant/minimal）
	// 使用统计
	UsageCount int `gorm:"default:0" json:"usageCount"` // 使用次数
	// 元数据
	CreatedBy string         `gorm:"type:varchar(50)" json:"createdBy"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant   Tenant             `gorm:"foreignKey:TenantID" json:"-"`
	Sections []DashboardSection `gorm:"foreignKey:TemplateID" json:"sections,omitempty"`
}

// DashboardInstance 大屏实例（用户基于模板创建的实例）
type DashboardInstance struct {
	ID           string `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	TemplateID   string `gorm:"type:varchar(50);index" json:"templateId"` // 关联的模板 ID
	Name         string `gorm:"size:200;not null" json:"name"`            // 实例名称
	Description  string `gorm:"size:500" json:"description"`
	IsPublic     bool   `gorm:"default:false" json:"isPublic"`        // 是否公开
	LayoutConfig string `gorm:"type:text" json:"layoutConfig"`        // 自定义布局配置
	ColorPalette string `gorm:"type:text" json:"colorPalette"`        // 自定义配色
	DataSourceID string `gorm:"type:varchar(50)" json:"dataSourceId"` // 数据源 ID
	// 刷新配置
	RefreshInterval int        `gorm:"default:300" json:"refreshInterval"` // 刷新间隔（秒）
	AutoRefresh     bool       `gorm:"default:true" json:"autoRefresh"`    // 是否自动刷新
	LastRefreshedAt *time.Time `json:"lastRefreshedAt"`
	// 使用统计
	ViewCount int `gorm:"default:0" json:"viewCount"` // 查看次数
	// 元数据
	CreatedBy string         `gorm:"type:varchar(50)" json:"createdBy"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant   Tenant             `gorm:"foreignKey:TenantID" json:"-"`
	Template DashboardTemplate  `gorm:"foreignKey:TemplateID" json:"template,omitempty"`
	Sections []DashboardSection `gorm:"foreignKey:InstanceID" json:"sections,omitempty"`
}

// RefreshToken 刷新令牌
type RefreshToken struct {
	ID        string     `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	UserID    string     `gorm:"type:varchar(50);not null;index" json:"userId"`
	Token     string     `gorm:"size:500;not null;uniqueIndex" json:"-"` // 刷新令牌
	ExpiresAt time.Time  `json:"expiresAt"`                              // 过期时间
	Revoked   bool       `gorm:"default:false" json:"-"`                 // 是否已吊销
	RevokedAt *time.Time `json:"revokedAt,omitempty"`                    // 吊销时间
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}

// AuthProvider 第三方认证提供商（预留）
type AuthProvider struct {
	ID           string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	UserID       string         `gorm:"type:varchar(50);not null;index" json:"userId"`
	ProviderType string         `gorm:"size:50;not null" json:"providerType"`            // google / github / wechat / dingtalk
	ProviderID   string         `gorm:"size:200;not null;uniqueIndex" json:"providerId"` // 第三方平台的用户 ID
	AccessToken  string         `gorm:"size:1000" json:"-"`                              // 第三方访问令牌
	RefreshToken string         `gorm:"size:1000" json:"-"`                              // 第三方刷新令牌
	ExpiresAt    *time.Time     `json:"expiresAt,omitempty"`                             // 令牌过期时间
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
	User   User   `gorm:"foreignKey:UserID" json:"-"`
}

// AnalysisQueryLog AI 问答分析日志（用于评估与持续优化）
type AnalysisQueryLog struct {
	ID               string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID         string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Question         string         `gorm:"type:text;not null" json:"question"`
	IntentType       string         `gorm:"size:50;not null" json:"intentType"`
	Metrics          string         `gorm:"type:text" json:"metrics"`    // JSON 数组
	Dimensions       string         `gorm:"type:text" json:"dimensions"` // JSON 数组
	TimeRange        string         `gorm:"size:100" json:"timeRange"`
	SQLText          string         `gorm:"type:text" json:"sqlText"`
	Confidence       string         `gorm:"size:20" json:"confidence"` // high/medium/low
	HadClarification bool           `gorm:"default:false" json:"hadClarification"`
	Success          bool           `gorm:"default:true" json:"success"`
	DurationMs       int64          `gorm:"default:0" json:"durationMs"`
	QualityIssues    string         `gorm:"type:text" json:"qualityIssues"` // JSON 数组
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

// AIServiceConfig AI 服务配置（按租户存储）
type AIServiceConfig struct {
	ID        string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID  string         `gorm:"type:varchar(50);not null;uniqueIndex" json:"tenantId"`
	ModelType string         `gorm:"size:50;not null;default:'openai'" json:"modelType"`
	Model     string         `gorm:"size:100;not null;default:'gpt-4o-mini'" json:"model"`
	BaseURL   string         `gorm:"size:500" json:"baseUrl,omitempty"`
	APIKey    string         `gorm:"size:1000" json:"-"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// ReportStatus 报表状态
type ReportStatus string

const (
	ReportStatusDraft     ReportStatus = "draft"     // 草稿
	ReportStatusPublished ReportStatus = "published" // 已发布
	ReportStatusArchived  ReportStatus = "archived"  // 已归档
)

// ReportType 报表类型
type ReportType string

const (
	ReportTypeDaily    ReportType = "daily"    // 日报
	ReportTypeWeekly   ReportType = "weekly"   // 周报
	ReportTypeMonthly  ReportType = "monthly"  // 月报
	ReportTypeCustom   ReportType = "custom"   // 自定义
	ReportTypeRealtime ReportType = "realtime" // 实时
)

// Report 数据报表
type Report struct {
	ID          string       `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string       `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Title       string       `gorm:"size:200;not null" json:"title"`
	Description string       `gorm:"size:500" json:"description"`
	Type        ReportType   `gorm:"size:50;default:'custom'" json:"type"`
	Status      ReportStatus `gorm:"size:50;default:'draft'" json:"status"`
	// 分类和标签
	Category string `gorm:"size:100" json:"category"` // sales/finance/operations/marketing/custom
	Tags     string `gorm:"size:500" json:"tags"`     // JSON 数组
	// 数据源
	DataSourceID string `gorm:"type:varchar(50)" json:"dataSourceId,omitempty"`
	// 布局配置
	LayoutConfig string `gorm:"type:text" json:"layoutConfig,omitempty"` // JSON：grid 布局配置
	ColorPalette string `gorm:"type:text" json:"colorPalette,omitempty"` // JSON：配色方案
	// 调度配置（定时报表）
	ScheduleEnabled bool   `gorm:"default:false" json:"scheduleEnabled"`
	ScheduleCron    string `gorm:"size:100" json:"scheduleCron,omitempty"` // cron 表达式
	// AI 相关
	AIGenerated bool   `gorm:"default:false" json:"aiGenerated"` // 是否 AI 生成
	AIPrompt    string `gorm:"type:text" json:"aiPrompt,omitempty"`
	// 使用统计
	ViewCount int `gorm:"default:0" json:"viewCount"`
	// 元数据
	CreatedBy string         `gorm:"type:varchar(50)" json:"createdBy"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant   Tenant          `gorm:"foreignKey:TenantID" json:"-"`
	Sections []ReportSection `gorm:"foreignKey:ReportID" json:"sections,omitempty"`
}

// ReportSection 报表区块（复用 DashboardSectionType 统一枚举）
type ReportSection struct {
	ID       string               `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID string               `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	ReportID string               `gorm:"type:varchar(50);not null;index" json:"reportId"`
	Type     DashboardSectionType `gorm:"size:50;not null" json:"type"` // 复用大屏区块类型
	Title    string               `gorm:"size:200" json:"title"`
	// 数据配置
	Metrics    string `gorm:"type:text" json:"metrics,omitempty"`    // JSON 数组：关联指标
	Dimensions string `gorm:"type:text" json:"dimensions,omitempty"` // JSON 数组：关联维度
	// 图表配置
	ChartConfig string `gorm:"type:text" json:"chartConfig,omitempty"` // JSON：图表详细配置
	DataConfig  string `gorm:"type:text" json:"dataConfig,omitempty"`  // JSON：数据查询/样本数据
	// 布局配置
	SortOrder int `gorm:"default:0" json:"sortOrder"` // 排列顺序
	ColSpan   int `gorm:"default:12" json:"colSpan"`  // 列宽 (1-12)
	RowSpan   int `gorm:"default:1" json:"rowSpan"`   // 行高
	// 数据查询配置
	TimeGrain  string `gorm:"size:50" json:"timeGrain,omitempty"`  // 时间粒度
	TopN       int    `json:"topN,omitempty"`                      // 排行 TopN
	Comparison string `gorm:"size:50" json:"comparison,omitempty"` // 对比维度
	FilterExpr string `gorm:"type:text" json:"filterExpr,omitempty"`
	// 元数据
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ============ 业务健康监控相关模型 ============

// MetricBaseline 指标基线快照
type MetricBaseline struct {
	ID            string    `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID      string    `gorm:"type:varchar(50);not null;index:idx_baseline_tenant_metric" json:"tenantId"`
	MetricID      string    `gorm:"type:varchar(50);not null;index:idx_baseline_tenant_metric" json:"metricId"`
	Granularity   string    `gorm:"size:20;not null" json:"granularity"` // hourly/daily/weekly
	PeriodKey     string    `gorm:"size:50;not null" json:"periodKey"`   // "2026-03-25" 或 "2026-03-25T14"
	ExpectedValue float64   `json:"expectedValue"`                       // 期望值
	StdDev        float64   `json:"stdDev"`                              // 标准差
	UpperBound    float64   `json:"upperBound"`                          // 上界
	LowerBound    float64   `json:"lowerBound"`                          // 下界
	SampleCount   int       `json:"sampleCount"`                         // 样本数量
	Method        string    `gorm:"size:50" json:"method"`               // moving_avg/percentile/stl
	ComputedAt    time.Time `json:"computedAt"`
	CreatedAt     time.Time `json:"createdAt"`
}

// AnomalySeverity 异常严重度
type AnomalySeverity string

const (
	SeverityInfo     AnomalySeverity = "info"
	SeverityWarning  AnomalySeverity = "warning"
	SeverityCritical AnomalySeverity = "critical"
)

// AnomalyStatus 异常状态
type AnomalyStatus string

const (
	AnomalyOpen          AnomalyStatus = "open"
	AnomalyAcknowledged  AnomalyStatus = "acknowledged"
	AnomalyResolved      AnomalyStatus = "resolved"
	AnomalyFalsePositive AnomalyStatus = "false_positive"
)

// BusinessCalendar 业务日历（用于降噪策略：节假日/大促自动调高阈值）
type BusinessCalendar struct {
	ID        string    `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID  string    `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Date      string    `gorm:"type:varchar(10);not null;index" json:"date"` // "2026-02-01"
	Name      string    `gorm:"size:200" json:"name"`                        // "春节假期" / "双十一大促"
	Type      string    `gorm:"size:20;not null" json:"type"`                // holiday / promotion / maintenance
	Threshold float64   `gorm:"default:1.5" json:"threshold"`                // 异常检测阈值倍数（默认1.5x，即偏离1.5倍才告警）
	CreatedAt time.Time `json:"createdAt"`
}

// AnomalyEvent 异常事件
type AnomalyEvent struct {
	ID            string          `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID      string          `gorm:"type:varchar(50);not null;index:idx_anomaly_tenant_time" json:"tenantId"`
	MetricID      string          `gorm:"type:varchar(50);not null;index" json:"metricId"`
	DetectedAt    time.Time       `gorm:"not null;index:idx_anomaly_tenant_time" json:"detectedAt"`
	ActualValue   float64         `json:"actualValue"`
	ExpectedValue float64         `json:"expectedValue"`
	Deviation     float64         `json:"deviation"` // 偏离程度（倍标准差）
	Severity      AnomalySeverity `gorm:"size:20;not null;index:idx_anomaly_status" json:"severity"`
	Confidence    float64         `json:"confidence"`                           // 置信度 0-1
	Direction     string          `gorm:"size:10" json:"direction"`             // up/down
	RootCause     string          `gorm:"type:text" json:"rootCause,omitempty"` // JSON：根因分析结果
	Status        AnomalyStatus   `gorm:"size:20;default:'open';index:idx_anomaly_status" json:"status"`
	NotifiedAt    *time.Time      `json:"notifiedAt,omitempty"`
	ResolvedAt    *time.Time      `json:"resolvedAt,omitempty"`
	UserFeedback  string          `gorm:"size:50" json:"userFeedback,omitempty"` // helpful/not_helpful/false_alarm
	CreatedAt     time.Time       `json:"createdAt"`
}

// DailySummary 每日业务摘要
type DailySummary struct {
	ID          string     `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID    string     `gorm:"type:varchar(50);not null;index:idx_summary_tenant_date" json:"tenantId"`
	SummaryDate string     `gorm:"size:20;not null;index:idx_summary_tenant_date" json:"summaryDate"` // "2026-03-25"
	HealthScore int        `json:"healthScore"`                                                       // 0-100
	Content     string     `gorm:"type:text;not null" json:"content"`                                 // JSON：结构化摘要内容
	SentAt      *time.Time `json:"sentAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// AutoMigrate 自动迁移所有表
func AutoMigrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&Tenant{},
		&User{},
		&IMConfig{},
		&NotificationRecord{},
		&AlertEvent{},
		&AlertTriggerLog{},
		&ChatConversation{},
		&ChatConversationMessage{},
		&DataSource{},
		&NotificationRule{},
		// 语义层模型
		&Metric{},
		&MetricLineage{},
		&Dimension{},
		&Relationship{},
		// 大屏模板和实例（先建实例表，再建依赖实例外键的区块表）
		&DashboardTemplate{},
		&DashboardInstance{},
		&DashboardSection{},
		// 认证相关
		&RefreshToken{},
		&AuthProvider{},
		// 手动上传数据集
		&UploadedDataset{},
		&DatasetVersion{},
		&DataQualityIssue{},
		&DatasetAccessLog{},
		// AI 问答分析
		&AnalysisQueryLog{},
		// AI 服务配置
		&AIServiceConfig{},
		// 手动上传数据集
		&UploadedDataset{},
		&DatasetVersion{},
		&DataQualityIssue{},
		&DatasetAccessLog{},
		// 报表
		&Report{},
		&ReportSection{},
		// 业务健康监控
		&MetricBaseline{},
		&AnomalyEvent{},
		&DailySummary{},
		&BusinessCalendar{},
	); err != nil {
		return err
	}

	// 修复历史遗留外键：早期版本曾把 metrics.base_table 误关联到 data_sources，导致 fk_metrics_data_source 约束错误。
	// 这里统一确保 fk_metrics_data_source 约束在 metrics.data_source_id 上。
	if db.Dialector != nil && db.Dialector.Name() == "postgres" {
		_ = db.Exec(`ALTER TABLE "metrics" DROP CONSTRAINT IF EXISTS "fk_metrics_data_source"`).Error
		_ = db.Exec(`
			ALTER TABLE "metrics"
			ADD CONSTRAINT "fk_metrics_data_source"
			FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id")
			ON UPDATE CASCADE
			ON DELETE RESTRICT
		`).Error
	}

	return nil
}
