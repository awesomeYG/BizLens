package model

import (
	"time"

	"gorm.io/gorm"
)

// UploadedDataset 用户上传的数据集
type UploadedDataset struct {
	ID           string         `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	TenantID     string         `gorm:"type:varchar(50);not null;index" json:"tenantId"`
	OwnerID      string         `gorm:"type:varchar(50);not null;index" json:"ownerId"`
	Name         string         `gorm:"size:200;not null" json:"name"`
	Description  string         `gorm:"size:500" json:"description"`
	FileName     string         `gorm:"size:200;not null" json:"fileName"`
	FileSize     int64          `gorm:"not null" json:"fileSize"`
	FileFormat   string         `gorm:"size:50;not null" json:"fileFormat"` // excel/csv/json/xml/pdf/word
	ObjectKey    string         `gorm:"size:500;not null" json:"objectKey"` // S3 对象存储 key
	RowCount     int            `gorm:"default:0" json:"rowCount"`
	ColumnCount  int            `gorm:"default:0" json:"columnCount"`
	Status       string         `gorm:"size:50;default:'uploading'" json:"status"` // uploading/parsing/ready/error
	Schema       string         `gorm:"type:text" json:"schema"`                   // JSON 字符串，存储字段 schema
	QualityScore float64        `gorm:"default:0" json:"qualityScore"`             // 质量评分 0-100
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant Tenant `gorm:"foreignKey:TenantID" json:"-"`
	Owner  User   `gorm:"foreignKey:OwnerID" json:"-"`
}

// DatasetVersion 数据集版本
type DatasetVersion struct {
	ID            string    `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	DatasetID     string    `gorm:"type:varchar(50);not null;index" json:"datasetId"`
	Version       int       `gorm:"not null;index" json:"version"`
	FileName      string    `gorm:"size:200;not null" json:"fileName"`
	FileSize      int64     `gorm:"not null" json:"fileSize"`
	ObjectKey     string    `gorm:"size:500;not null" json:"objectKey"`
	RowCount      int       `gorm:"default:0" json:"rowCount"`
	ColumnCount   int       `gorm:"default:0" json:"columnCount"`
	ChangeSummary string    `gorm:"type:text" json:"changeSummary"`
	CreatedAt     time.Time `json:"createdAt"`

	Dataset UploadedDataset `gorm:"foreignKey:DatasetID" json:"-"`
}

// DataQualityIssue 数据质量问题
type DataQualityIssue struct {
	ID            string     `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	DatasetID     string     `gorm:"type:varchar(50);not null;index" json:"datasetId"`
	RuleID        string     `gorm:"size:100;not null" json:"ruleId"`
	RuleName      string     `gorm:"size:200" json:"ruleName"`
	FieldName     string     `gorm:"size:200;index" json:"fieldName"`
	Severity      string     `gorm:"size:20;not null" json:"severity"` // high/medium/low
	Message       string     `gorm:"type:text;not null" json:"message"`
	AffectedRows  string     `gorm:"type:text" json:"affectedRows"` // JSON 数组，存储受影响的行号
	AffectedRatio float64    `json:"affectedRatio"`
	Suggestion    string     `gorm:"type:text" json:"suggestion"`
	Status        string     `gorm:"size:20;default:'open'" json:"status"` // open/resolved/ignored
	ResolvedAt    *time.Time `json:"resolvedAt,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`

	Dataset UploadedDataset `gorm:"foreignKey:DatasetID" json:"-"`
}

// DatasetAccessLog 数据集访问日志
type DatasetAccessLog struct {
	ID        string    `gorm:"type:varchar(50);primaryKey;default:null" json:"id"`
	DatasetID string    `gorm:"type:varchar(50);not null;index" json:"datasetId"`
	UserID    string    `gorm:"type:varchar(50);not null;index" json:"userId"`
	Action    string    `gorm:"size:50;not null" json:"action"` // view/download/delete/update
	IPAddress string    `gorm:"size:50" json:"ipAddress"`
	CreatedAt time.Time `json:"createdAt"`

	Dataset UploadedDataset `gorm:"foreignKey:DatasetID" json:"-"`
}
