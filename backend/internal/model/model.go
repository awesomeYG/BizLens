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
	ID        string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID  string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Name      string         `gorm:"size:100;not null" json:"name"`
	Email     string         `gorm:"size:200;not null;uniqueIndex" json:"email"`
	Role      string         `gorm:"size:50;default:'member'" json:"role"` // owner / admin / member
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

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
	ID         string             `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID   string             `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	Type       IMPlatformType     `gorm:"size:50;not null" json:"type"`
	Name       string             `gorm:"size:200;not null" json:"name"`
	Enabled    bool               `gorm:"default:true" json:"enabled"`
	WebhookURL string             `gorm:"size:500;not null" json:"webhookUrl"`
	Secret     string             `gorm:"size:500" json:"secret,omitempty"`
	Status     IMConnectionStatus `gorm:"size:50;default:'disconnected'" json:"status"`
	CreatedAt  time.Time          `json:"createdAt"`
	UpdatedAt  time.Time          `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt     `gorm:"index" json:"-"`

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
	TemplateType string             `gorm:"size:50;not null" json:"templateType"`
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
	TriggeredAt time.Time `json:"triggeredAt"`
	CreatedAt   time.Time `json:"createdAt"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
}

// DataSourceType 数据源类型
type DataSourceType string

const (
	DataSourceMySQL      DataSourceType = "mysql"
	DataSourcePostgreSQL DataSourceType = "postgresql"
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

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
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
	DataSource DataSource `gorm:"foreignKey:BaseTable" json:"-"` // 通过表名关联数据源
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

// AutoMigrate 自动迁移所有表
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Tenant{},
		&User{},
		&IMConfig{},
		&NotificationRecord{},
		&AlertEvent{},
		&AlertTriggerLog{},
		&DataSource{},
		&NotificationRule{},
		// 语义层模型
		&Metric{},
		&MetricLineage{},
		&Dimension{},
		&Relationship{},
	)
}
