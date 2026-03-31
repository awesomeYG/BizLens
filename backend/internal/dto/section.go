package dto

import (
	"encoding/json"
	"time"

	"ai-bi-server/internal/model"
)

// SectionOwnerType 区块所属对象的类型
type SectionOwnerType string

const (
	OwnerReport            SectionOwnerType = "report"   // 报表
	OwnerTemplate          SectionOwnerType = "template" // 大屏模板
	OwnerDashboardInstance SectionOwnerType = "instance" // 大屏实例
)

// SectionDTO 统一区块数据传输对象（报表和大屏共用）
// 注意：报表使用 colSpan/rowSpan（grid 布局），大屏使用 row/col/width/height（绝对坐标布局）
type SectionDTO struct {
	ID          string                 `json:"id"`
	OwnerType   SectionOwnerType       `json:"ownerType"` // 所属类型
	OwnerID     string                 `json:"ownerId"`   // 所属对象 ID（report_id / template_id / instance_id）
	TenantID    string                 `json:"tenantId,omitempty"`
	Type        string                 `json:"type"` // DashboardSectionType
	Title       string                 `json:"title,omitempty"`
	Metrics     []string               `json:"metrics,omitempty"`
	Dimensions  []string               `json:"dimensions,omitempty"`
	ChartConfig map[string]interface{} `json:"chartConfig,omitempty"`
	// 报表布局（grid 12列栅格）
	SortOrder int `json:"sortOrder"`
	ColSpan   int `json:"colSpan"` // 1-12
	RowSpan   int `json:"rowSpan"`
	// 大屏布局（绝对坐标）
	Row      int `json:"row"`
	Col      int `json:"col"`
	Width    int `json:"width"`
	Height   int `json:"height"`
	Priority int `json:"priority"`
	// 数据配置
	TimeGrain    string    `json:"timeGrain,omitempty"`  // hour/day/week/month
	TopN         int       `json:"topN,omitempty"`       // 排行 TopN
	Comparison   string    `json:"comparison,omitempty"` // 对比维度
	SplitBy      string    `json:"splitBy,omitempty"`    // 拆分维度
	FilterExpr   string    `json:"filterExpr,omitempty"` // 过滤条件
	DataConfig   string    `json:"dataConfig,omitempty"` // 报表专属：数据配置 JSON 字符串
	AutoGenerate bool      `json:"autoGenerate"`         // 是否 AI 自动生成
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// ToSectionModel 转换为 GORM 模型（DashboardSection）
// ownerType 和 ownerID 指定关联关系（template_id / instance_id）
func (d *SectionDTO) ToDashboardSectionModel(ownerType SectionOwnerType, ownerID string) model.DashboardSection {
	s := model.DashboardSection{
		ID:           d.ID,
		Type:         model.DashboardSectionType(d.Type),
		Title:        d.Title,
		Row:          d.Row,
		Col:          d.Col,
		Width:        d.Width,
		Height:       d.Height,
		Priority:     d.Priority,
		TimeGrain:    d.TimeGrain,
		TopN:         d.TopN,
		Comparison:   d.Comparison,
		SplitBy:      d.SplitBy,
		FilterExpr:   d.FilterExpr,
		AutoGenerate: d.AutoGenerate,
	}

	// 根据 ownerType 设置关联
	switch ownerType {
	case OwnerTemplate:
		s.TemplateID = ownerID
	case OwnerDashboardInstance:
		s.InstanceID = &ownerID
	}

	// 序列化数组字段
	if len(d.Metrics) > 0 {
		b, _ := json.Marshal(d.Metrics)
		s.Metrics = string(b)
	}
	if len(d.Dimensions) > 0 {
		b, _ := json.Marshal(d.Dimensions)
		s.Dimensions = string(b)
	}
	if d.ChartConfig != nil {
		b, _ := json.Marshal(d.ChartConfig)
		s.ChartConfig = string(b)
	}

	return s
}

// ToReportSectionModel 转换为 GORM 模型（ReportSection）
func (d *SectionDTO) ToReportSectionModel(reportID string) model.ReportSection {
	s := model.ReportSection{
		ID:         d.ID,
		ReportID:   reportID,
		Type:       model.DashboardSectionType(d.Type),
		Title:      d.Title,
		SortOrder:  d.SortOrder,
		ColSpan:    d.ColSpan,
		RowSpan:    d.RowSpan,
		TimeGrain:  d.TimeGrain,
		TopN:       d.TopN,
		Comparison: d.Comparison,
		FilterExpr: d.FilterExpr,
	}

	// 序列化数组字段
	if len(d.Metrics) > 0 {
		b, _ := json.Marshal(d.Metrics)
		s.Metrics = string(b)
	}
	if len(d.Dimensions) > 0 {
		b, _ := json.Marshal(d.Dimensions)
		s.Dimensions = string(b)
	}
	if d.ChartConfig != nil {
		b, _ := json.Marshal(d.ChartConfig)
		s.ChartConfig = string(b)
	}
	if d.DataConfig != "" {
		s.DataConfig = d.DataConfig
	}

	return s
}

// FromDashboardSection 将 DashboardSection 模型转换为统一 DTO
func FromDashboardSection(s model.DashboardSection, ownerType SectionOwnerType, ownerID string) SectionDTO {
	dto := SectionDTO{
		ID:           s.ID,
		OwnerType:    ownerType,
		OwnerID:      ownerID,
		TenantID:     s.TenantID,
		Type:         string(s.Type),
		Title:        s.Title,
		SortOrder:    0,
		ColSpan:      0,
		RowSpan:      0,
		Row:          s.Row,
		Col:          s.Col,
		Width:        s.Width,
		Height:       s.Height,
		Priority:     s.Priority,
		TimeGrain:    s.TimeGrain,
		TopN:         s.TopN,
		Comparison:   s.Comparison,
		SplitBy:      s.SplitBy,
		FilterExpr:   s.FilterExpr,
		AutoGenerate: s.AutoGenerate,
		CreatedAt:    s.CreatedAt,
		UpdatedAt:    s.UpdatedAt,
	}

	if s.Metrics != "" {
		json.Unmarshal([]byte(s.Metrics), &dto.Metrics)
	}
	if s.Dimensions != "" {
		json.Unmarshal([]byte(s.Dimensions), &dto.Dimensions)
	}
	if s.ChartConfig != "" {
		json.Unmarshal([]byte(s.ChartConfig), &dto.ChartConfig)
	}

	return dto
}

// FromReportSection 将 ReportSection 模型转换为统一 DTO
func FromReportSection(s model.ReportSection, reportID string) SectionDTO {
	dto := SectionDTO{
		ID:         s.ID,
		OwnerType:  OwnerReport,
		OwnerID:    reportID,
		TenantID:   s.TenantID,
		Type:       string(s.Type),
		Title:      s.Title,
		SortOrder:  s.SortOrder,
		ColSpan:    s.ColSpan,
		RowSpan:    s.RowSpan,
		TimeGrain:  s.TimeGrain,
		TopN:       s.TopN,
		Comparison: s.Comparison,
		FilterExpr: s.FilterExpr,
		DataConfig: s.DataConfig,
		CreatedAt:  s.CreatedAt,
		UpdatedAt:  s.UpdatedAt,
	}

	if s.Metrics != "" {
		json.Unmarshal([]byte(s.Metrics), &dto.Metrics)
	}
	if s.Dimensions != "" {
		json.Unmarshal([]byte(s.Dimensions), &dto.Dimensions)
	}
	if s.ChartConfig != "" {
		json.Unmarshal([]byte(s.ChartConfig), &dto.ChartConfig)
	}

	return dto
}

// CreateSectionRequest 创建区块请求
type CreateSectionRequest struct {
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Metrics     []string               `json:"metrics"`
	Dimensions  []string               `json:"dimensions"`
	ChartConfig map[string]interface{} `json:"chartConfig"`
	// 报表布局
	SortOrder int `json:"sortOrder"`
	ColSpan   int `json:"colSpan"`
	RowSpan   int `json:"rowSpan"`
	// 大屏布局
	Row      int `json:"row"`
	Col      int `json:"col"`
	Width    int `json:"width"`
	Height   int `json:"height"`
	Priority int `json:"priority"`
	// 数据配置
	TimeGrain    string `json:"timeGrain"`
	TopN         int    `json:"topN"`
	Comparison   string `json:"comparison"`
	SplitBy      string `json:"splitBy"`
	FilterExpr   string `json:"filterExpr"`
	DataConfig   string `json:"dataConfig"`
	AutoGenerate bool   `json:"autoGenerate"`
}

// ToDTO 将 CreateSectionRequest 转换为 SectionDTO
func (r *CreateSectionRequest) ToDTO() SectionDTO {
	return SectionDTO{
		Type:         r.Type,
		Title:        r.Title,
		Metrics:      r.Metrics,
		Dimensions:   r.Dimensions,
		ChartConfig:  r.ChartConfig,
		SortOrder:    r.SortOrder,
		ColSpan:      r.ColSpan,
		RowSpan:      r.RowSpan,
		Row:          r.Row,
		Col:          r.Col,
		Width:        r.Width,
		Height:       r.Height,
		Priority:     r.Priority,
		TimeGrain:    r.TimeGrain,
		TopN:         r.TopN,
		Comparison:   r.Comparison,
		SplitBy:      r.SplitBy,
		FilterExpr:   r.FilterExpr,
		DataConfig:   r.DataConfig,
		AutoGenerate: r.AutoGenerate,
	}
}
