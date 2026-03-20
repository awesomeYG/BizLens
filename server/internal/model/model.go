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

// AutoMigrate 自动迁移所有表
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Tenant{},
		&User{},
		&IMConfig{},
		&NotificationRecord{},
		&AlertEvent{},
		&AlertTriggerLog{},
	)
}
