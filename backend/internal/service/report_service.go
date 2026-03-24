package service

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"ai-bi-server/internal/model"
)

// ReportDTO 报表数据传输对象
type ReportDTO struct {
	ID              string             `json:"id"`
	TenantID        string             `json:"tenantId"`
	Title           string             `json:"title"`
	Description     string             `json:"description"`
	Type            string             `json:"type"`
	Status          string             `json:"status"`
	Category        string             `json:"category"`
	Tags            []string           `json:"tags"`
	DataSourceID    string             `json:"dataSourceId,omitempty"`
	LayoutConfig    string             `json:"layoutConfig,omitempty"`
	ColorPalette    string             `json:"colorPalette,omitempty"`
	ScheduleEnabled bool               `json:"scheduleEnabled"`
	ScheduleCron    string             `json:"scheduleCron,omitempty"`
	AIGenerated     bool               `json:"aiGenerated"`
	AIPrompt        string             `json:"aiPrompt,omitempty"`
	ViewCount       int                `json:"viewCount"`
	CreatedBy       string             `json:"createdBy"`
	Sections        []ReportSectionDTO `json:"sections,omitempty"`
	CreatedAt       time.Time          `json:"createdAt"`
	UpdatedAt       time.Time          `json:"updatedAt"`
}

// ReportSectionDTO 报表区块数据传输对象
type ReportSectionDTO struct {
	ID          string                 `json:"id"`
	ReportID    string                 `json:"reportId"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title,omitempty"`
	Metrics     []string               `json:"metrics,omitempty"`
	Dimensions  []string               `json:"dimensions,omitempty"`
	ChartConfig map[string]interface{} `json:"chartConfig,omitempty"`
	DataConfig  map[string]interface{} `json:"dataConfig,omitempty"`
	SortOrder   int                    `json:"sortOrder"`
	ColSpan     int                    `json:"colSpan"`
	RowSpan     int                    `json:"rowSpan"`
	TimeGrain   string                 `json:"timeGrain,omitempty"`
	TopN        int                    `json:"topN,omitempty"`
	Comparison  string                 `json:"comparison,omitempty"`
	FilterExpr  string                 `json:"filterExpr,omitempty"`
}

// ConvertReportToDTO 将 Report 模型转换为 DTO
func ConvertReportToDTO(report model.Report) ReportDTO {
	var tags []string
	if report.Tags != "" {
		json.Unmarshal([]byte(report.Tags), &tags)
	}

	var sections []ReportSectionDTO
	for _, s := range report.Sections {
		sections = append(sections, ConvertReportSectionToDTO(s))
	}

	return ReportDTO{
		ID:              report.ID,
		TenantID:        report.TenantID,
		Title:           report.Title,
		Description:     report.Description,
		Type:            string(report.Type),
		Status:          string(report.Status),
		Category:        report.Category,
		Tags:            tags,
		DataSourceID:    report.DataSourceID,
		LayoutConfig:    report.LayoutConfig,
		ColorPalette:    report.ColorPalette,
		ScheduleEnabled: report.ScheduleEnabled,
		ScheduleCron:    report.ScheduleCron,
		AIGenerated:     report.AIGenerated,
		AIPrompt:        report.AIPrompt,
		ViewCount:       report.ViewCount,
		CreatedBy:       report.CreatedBy,
		Sections:        sections,
		CreatedAt:       report.CreatedAt,
		UpdatedAt:       report.UpdatedAt,
	}
}

// ConvertReportSectionToDTO 将 ReportSection 模型转换为 DTO
func ConvertReportSectionToDTO(s model.ReportSection) ReportSectionDTO {
	var metrics []string
	if s.Metrics != "" {
		json.Unmarshal([]byte(s.Metrics), &metrics)
	}

	var dimensions []string
	if s.Dimensions != "" {
		json.Unmarshal([]byte(s.Dimensions), &dimensions)
	}

	var chartConfig map[string]interface{}
	if s.ChartConfig != "" {
		json.Unmarshal([]byte(s.ChartConfig), &chartConfig)
	}

	var dataConfig map[string]interface{}
	if s.DataConfig != "" {
		json.Unmarshal([]byte(s.DataConfig), &dataConfig)
	}

	return ReportSectionDTO{
		ID:          s.ID,
		ReportID:    s.ReportID,
		Type:        string(s.Type),
		Title:       s.Title,
		Metrics:     metrics,
		Dimensions:  dimensions,
		ChartConfig: chartConfig,
		DataConfig:  dataConfig,
		SortOrder:   s.SortOrder,
		ColSpan:     s.ColSpan,
		RowSpan:     s.RowSpan,
		TimeGrain:   s.TimeGrain,
		TopN:        s.TopN,
		Comparison:  s.Comparison,
		FilterExpr:  s.FilterExpr,
	}
}

// ReportService 报表服务
type ReportService struct {
	db *gorm.DB
}

// NewReportService 创建报表服务
func NewReportService(db *gorm.DB) *ReportService {
	return &ReportService{db: db}
}

// ListReports 获取租户下所有报表
func (s *ReportService) ListReports(tenantID string, status string, category string) ([]ReportDTO, error) {
	var reports []model.Report
	q := s.db.Where("tenant_id = ?", tenantID).Preload("Sections", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	})

	if status != "" {
		q = q.Where("status = ?", status)
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}

	err := q.Order("updated_at DESC").Find(&reports).Error
	if err != nil {
		return nil, err
	}

	var result []ReportDTO
	for _, r := range reports {
		result = append(result, ConvertReportToDTO(r))
	}
	return result, nil
}

// GetReport 获取单个报表（含区块）
func (s *ReportService) GetReport(tenantID, id string) (*ReportDTO, error) {
	var report model.Report
	err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).
		Preload("Sections", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).First(&report).Error
	if err != nil {
		return nil, err
	}

	// 增加浏览次数
	s.db.Model(&report).UpdateColumn("view_count", gorm.Expr("view_count + 1"))

	dto := ConvertReportToDTO(report)
	return &dto, nil
}

// CreateReportRequest 创建报表请求
type CreateReportRequest struct {
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	Type         string                 `json:"type"`
	Category     string                 `json:"category"`
	Tags         []string               `json:"tags"`
	DataSourceID string                 `json:"dataSourceId"`
	LayoutConfig string                 `json:"layoutConfig"`
	ColorPalette string                 `json:"colorPalette"`
	AIGenerated  bool                   `json:"aiGenerated"`
	AIPrompt     string                 `json:"aiPrompt"`
	Sections     []CreateSectionRequest `json:"sections"`
}

// CreateSectionRequest 创建区块请求
type CreateSectionRequest struct {
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Metrics     []string               `json:"metrics"`
	Dimensions  []string               `json:"dimensions"`
	ChartConfig map[string]interface{} `json:"chartConfig"`
	DataConfig  map[string]interface{} `json:"dataConfig"`
	SortOrder   int                    `json:"sortOrder"`
	ColSpan     int                    `json:"colSpan"`
	RowSpan     int                    `json:"rowSpan"`
	TimeGrain   string                 `json:"timeGrain"`
	TopN        int                    `json:"topN"`
	Comparison  string                 `json:"comparison"`
	FilterExpr  string                 `json:"filterExpr"`
}

// CreateReport 创建报表（含区块）
func (s *ReportService) CreateReport(tenantID, userID string, req CreateReportRequest) (*ReportDTO, error) {
	if req.Title == "" {
		return nil, errors.New("报表标题不能为空")
	}

	// 序列化 tags
	tagsJSON := "[]"
	if len(req.Tags) > 0 {
		b, _ := json.Marshal(req.Tags)
		tagsJSON = string(b)
	}

	reportType := model.ReportType(req.Type)
	if reportType == "" {
		reportType = model.ReportTypeCustom
	}

	category := req.Category
	if category == "" {
		category = "custom"
	}

	report := model.Report{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Title:        req.Title,
		Description:  req.Description,
		Type:         reportType,
		Status:       model.ReportStatusDraft,
		Category:     category,
		Tags:         tagsJSON,
		DataSourceID: req.DataSourceID,
		LayoutConfig: req.LayoutConfig,
		ColorPalette: req.ColorPalette,
		AIGenerated:  req.AIGenerated,
		AIPrompt:     req.AIPrompt,
		CreatedBy:    userID,
	}

	// 在事务中创建报表和区块
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&report).Error; err != nil {
			return err
		}

		for i, sec := range req.Sections {
			section := s.buildSection(tenantID, report.ID, sec, i)
			if err := tx.Create(&section).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetReport(tenantID, report.ID)
}

// UpdateReportRequest 更新报表请求
type UpdateReportRequest struct {
	Title        *string                 `json:"title,omitempty"`
	Description  *string                 `json:"description,omitempty"`
	Type         *string                 `json:"type,omitempty"`
	Status       *string                 `json:"status,omitempty"`
	Category     *string                 `json:"category,omitempty"`
	Tags         *[]string               `json:"tags,omitempty"`
	DataSourceID *string                 `json:"dataSourceId,omitempty"`
	LayoutConfig *string                 `json:"layoutConfig,omitempty"`
	ColorPalette *string                 `json:"colorPalette,omitempty"`
	Sections     *[]CreateSectionRequest `json:"sections,omitempty"`
}

// UpdateReport 更新报表
func (s *ReportService) UpdateReport(tenantID, id string, req UpdateReportRequest) (*ReportDTO, error) {
	var report model.Report
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&report).Error; err != nil {
		return nil, errors.New("报表不存在")
	}

	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Tags != nil {
		b, _ := json.Marshal(*req.Tags)
		updates["tags"] = string(b)
	}
	if req.DataSourceID != nil {
		updates["data_source_id"] = *req.DataSourceID
	}
	if req.LayoutConfig != nil {
		updates["layout_config"] = *req.LayoutConfig
	}
	if req.ColorPalette != nil {
		updates["color_palette"] = *req.ColorPalette
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(&report).Updates(updates).Error; err != nil {
				return err
			}
		}

		// 如果传入了新的 sections，替换旧的
		if req.Sections != nil {
			// 软删除旧区块
			if err := tx.Where("report_id = ? AND tenant_id = ?", id, tenantID).Delete(&model.ReportSection{}).Error; err != nil {
				return err
			}
			// 创建新区块
			for i, sec := range *req.Sections {
				section := s.buildSection(tenantID, id, sec, i)
				if err := tx.Create(&section).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetReport(tenantID, id)
}

// DeleteReport 删除报表
func (s *ReportService) DeleteReport(tenantID, id string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 删除区块
		if err := tx.Where("report_id = ? AND tenant_id = ?", id, tenantID).Delete(&model.ReportSection{}).Error; err != nil {
			return err
		}
		// 删除报表
		result := tx.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&model.Report{})
		if result.RowsAffected == 0 {
			return errors.New("报表不存在")
		}
		return result.Error
	})
}

// DuplicateReport 复制报表
func (s *ReportService) DuplicateReport(tenantID, id, userID string) (*ReportDTO, error) {
	var original model.Report
	err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).
		Preload("Sections", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).First(&original).Error
	if err != nil {
		return nil, errors.New("原报表不存在")
	}

	newReport := model.Report{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Title:        original.Title + " (副本)",
		Description:  original.Description,
		Type:         original.Type,
		Status:       model.ReportStatusDraft,
		Category:     original.Category,
		Tags:         original.Tags,
		DataSourceID: original.DataSourceID,
		LayoutConfig: original.LayoutConfig,
		ColorPalette: original.ColorPalette,
		AIGenerated:  original.AIGenerated,
		AIPrompt:     original.AIPrompt,
		CreatedBy:    userID,
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&newReport).Error; err != nil {
			return err
		}
		for _, sec := range original.Sections {
			newSec := model.ReportSection{
				ID:          uuid.New().String(),
				TenantID:    tenantID,
				ReportID:    newReport.ID,
				Type:        sec.Type,
				Title:       sec.Title,
				Metrics:     sec.Metrics,
				Dimensions:  sec.Dimensions,
				ChartConfig: sec.ChartConfig,
				DataConfig:  sec.DataConfig,
				SortOrder:   sec.SortOrder,
				ColSpan:     sec.ColSpan,
				RowSpan:     sec.RowSpan,
				TimeGrain:   sec.TimeGrain,
				TopN:        sec.TopN,
				Comparison:  sec.Comparison,
				FilterExpr:  sec.FilterExpr,
			}
			if err := tx.Create(&newSec).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetReport(tenantID, newReport.ID)
}

// buildSection 构建 ReportSection 模型
func (s *ReportService) buildSection(tenantID, reportID string, req CreateSectionRequest, index int) model.ReportSection {
	metricsJSON := ""
	if len(req.Metrics) > 0 {
		b, _ := json.Marshal(req.Metrics)
		metricsJSON = string(b)
	}
	dimJSON := ""
	if len(req.Dimensions) > 0 {
		b, _ := json.Marshal(req.Dimensions)
		dimJSON = string(b)
	}
	chartJSON := ""
	if req.ChartConfig != nil {
		b, _ := json.Marshal(req.ChartConfig)
		chartJSON = string(b)
	}
	dataJSON := ""
	if req.DataConfig != nil {
		b, _ := json.Marshal(req.DataConfig)
		dataJSON = string(b)
	}

	colSpan := req.ColSpan
	if colSpan <= 0 {
		colSpan = 12
	}
	rowSpan := req.RowSpan
	if rowSpan <= 0 {
		rowSpan = 1
	}
	sortOrder := req.SortOrder
	if sortOrder == 0 {
		sortOrder = index
	}

	return model.ReportSection{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		ReportID:    reportID,
		Type:        model.DashboardSectionType(req.Type),
		Title:       req.Title,
		Metrics:     metricsJSON,
		Dimensions:  dimJSON,
		ChartConfig: chartJSON,
		DataConfig:  dataJSON,
		SortOrder:   sortOrder,
		ColSpan:     colSpan,
		RowSpan:     rowSpan,
		TimeGrain:   req.TimeGrain,
		TopN:        req.TopN,
		Comparison:  req.Comparison,
		FilterExpr:  req.FilterExpr,
	}
}
