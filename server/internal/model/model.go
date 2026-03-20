package model

import (
	"encoding/json"
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

// AIFindingType AI 发现类型
type AIFindingType string

const (
	AIFindingPattern   AIFindingType = "pattern"   // 数据模式
	AIFindingAnomaly   AIFindingType = "anomaly"   // 异常检测
	AIFindingTrend     AIFindingType = "trend"     // 趋势分析
	AIFindingInsight   AIFindingType = "insight"   // 业务洞察
	AIFindingRecommend AIFindingType = "recommend" // 优化建议
)

// AIFindingSeverity 发现严重程度
type AIFindingSeverity string

const (
	AIFindingSeverityHigh   AIFindingSeverity = "high"
	AIFindingSeverityMedium AIFindingSeverity = "medium"
	AIFindingSeverityLow    AIFindingSeverity = "low"
	AIFindingSeverityInfo   AIFindingSeverity = "info"
)

// AIFinding AI 自动发现结果
type AIFinding struct {
	ID           string            `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string            `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	DataSourceID string            `gorm:"type:varchar(50);not null;index" json:"dataSourceId"`
	Type         AIFindingType     `gorm:"size:50;not null" json:"type"`
	Severity     AIFindingSeverity `gorm:"size:50;default:'info'" json:"severity"`
	Title        string            `gorm:"size:500;not null" json:"title"`
	Description  string            `gorm:"type:text;not null" json:"description"`
	TableName    string            `gorm:"size:200" json:"tableName,omitempty"`
	ColumnName   string            `gorm:"size:200" json:"columnName,omitempty"`
	MetricValue  float64           `json:"metricValue,omitempty"`
	Evidence     string            `gorm:"type:text" json:"evidence,omitempty"` // JSON 数组，存储支持数据
	Suggestion   string            `gorm:"type:text" json:"suggestion,omitempty"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt    `gorm:"index" json:"-"`

	DataSource DataSource `gorm:"foreignKey:DataSourceID" json:"dataSource,omitempty"`
	Tenant     Tenant     `gorm:"foreignKey:TenantID" json:"-"`
}

// DashboardLayoutType 大屏布局类型
type DashboardLayoutType string

const (
	LayoutAuto  DashboardLayoutType = "auto"  // AI 自动布局
	LayoutGrid  DashboardLayoutType = "grid"  // 网格布局
	LayoutFree  DashboardLayoutType = "free"  // 自由布局
	LayoutStory DashboardLayoutType = "story" // 故事线布局
)

// DashboardConfig 大屏配置
type DashboardConfig struct {
	ID           string              `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string              `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	DataSourceID string              `gorm:"type:varchar(50);not null;index" json:"dataSourceId"`
	Name         string              `gorm:"size:200;not null" json:"name"`
	Description  string              `gorm:"size:500" json:"description"`
	LayoutType   DashboardLayoutType `gorm:"size:50;default:'auto'" json:"layoutType"`
	Widgets      string              `gorm:"type:text" json:"widgets,omitempty"`    // JSON 数组，存储组件配置
	StoryOrder   string              `gorm:"type:text" json:"storyOrder,omitempty"` // JSON 数组，故事线顺序
	Theme        string              `gorm:"size:100;default:'default'" json:"theme"`
	IsAutoGen    bool                `gorm:"default:false" json:"isAutoGen"` // 是否 AI 自动生成
	CreatedAt    time.Time           `json:"createdAt"`
	UpdatedAt    time.Time           `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt      `gorm:"index" json:"-"`

	DataSource DataSource `gorm:"foreignKey:DataSourceID" json:"dataSource,omitempty"`
	Tenant     Tenant     `gorm:"foreignKey:TenantID" json:"-"`
}

// SemanticModelCache 语义模型缓存（用于 AI 对话增强）
type SemanticModelCache struct {
	ID           string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	DataSourceID string         `gorm:"type:varchar(50);not null;index" json:"dataSourceId"`
	Metrics      string         `gorm:"type:text" json:"metrics,omitempty"`    // JSON 数组
	Dimensions   string         `gorm:"type:text" json:"dimensions,omitempty"` // JSON 数组
	Relations    string         `gorm:"type:text" json:"relations,omitempty"`  // JSON 数组
	NLQueries    string         `gorm:"type:text" json:"nlQueries,omitempty"`  // JSON 数组，存储常见自然语言查询模式
	LastBuiltAt  time.Time      `json:"lastBuiltAt"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	DataSource DataSource `gorm:"foreignKey:DataSourceID" json:"dataSource,omitempty"`
	Tenant     Tenant     `gorm:"foreignKey:TenantID" json:"-"`
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
		&AIFinding{},
		&DashboardConfig{},
		&SemanticModelCache{},
	)
}

// SerializeSchemaInfo 序列化 schema 信息为 JSON
func SerializeSchemaInfo(schema map[string]interface{}) (string, error) {
	data, err := json.Marshal(schema)
	return string(data), err
}

// DeserializeSchemaInfo 反序列化 schema 信息
func DeserializeSchemaInfo(data string) (map[string]interface{}, error) {
	var schema map[string]interface{}
	err := json.Unmarshal([]byte(data), &schema)
	return schema, err
}
