package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"ai-bi-server/internal/dto"
	"ai-bi-server/internal/model"
)

// DashboardTemplateDTO 模板数据传输对象（复用统一 SectionDTO）
type DashboardTemplateDTO struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	Description  string           `json:"description"`
	Category     string           `json:"category"`
	Icon         string           `json:"icon"`
	IsSystem     bool             `json:"isSystem"`
	IsPublic     bool             `json:"isPublic"`
	Tags         []string         `json:"tags"`
	LayoutConfig string           `json:"layoutConfig"`
	ColorPalette string           `json:"colorPalette"`
	ColorTone    string           `json:"colorTone"`
	UsageCount   int              `json:"usageCount"`
	Sections     []dto.SectionDTO `json:"sections,omitempty"`
	CreatedAt    time.Time        `json:"createdAt"`
	UpdatedAt    time.Time        `json:"updatedAt"`
}

// DashboardInstanceDTO 实例数据传输对象（复用统一 SectionDTO）
type DashboardInstanceDTO struct {
	ID              string                `json:"id"`
	TemplateID      string                `json:"templateId"`
	TenantID        string                `json:"tenantId"`
	Name            string                `json:"name"`
	Description     string                `json:"description"`
	IsPublic        bool                  `json:"isPublic"`
	LayoutConfig    string                `json:"layoutConfig"`
	ColorPalette    string                `json:"colorPalette"`
	DataSourceID    string                `json:"dataSourceId"`
	RefreshInterval int                   `json:"refreshInterval"`
	AutoRefresh     bool                  `json:"autoRefresh"`
	LastRefreshedAt *time.Time            `json:"lastRefreshedAt"`
	ViewCount       int                   `json:"viewCount"`
	Template        *DashboardTemplateDTO `json:"template,omitempty"`
	Sections        []dto.SectionDTO      `json:"sections,omitempty"`
	CreatedAt       time.Time             `json:"createdAt"`
	UpdatedAt       time.Time             `json:"updatedAt"`
}

// ConvertTemplateToDTO 转换模板为 DTO
func ConvertTemplateToDTO(template model.DashboardTemplate) DashboardTemplateDTO {
	var tags []string
	if template.Tags != "" {
		json.Unmarshal([]byte(template.Tags), &tags)
	}

	sections := make([]dto.SectionDTO, 0, len(template.Sections))
	for _, s := range template.Sections {
		sections = append(sections, dto.FromDashboardSection(s, dto.OwnerTemplate, template.ID))
	}

	return DashboardTemplateDTO{
		ID:           template.ID,
		Name:         template.Name,
		Description:  template.Description,
		Category:     template.Category,
		Icon:         template.Icon,
		IsSystem:     template.IsSystem,
		IsPublic:     template.IsPublic,
		Tags:         tags,
		LayoutConfig: template.LayoutConfig,
		ColorPalette: template.ColorPalette,
		ColorTone:    template.ColorTone,
		UsageCount:   template.UsageCount,
		Sections:     sections,
		CreatedAt:    template.CreatedAt,
		UpdatedAt:    template.UpdatedAt,
	}
}

// ConvertInstanceToDTO 转换实例为 DTO
func ConvertInstanceToDTO(instance model.DashboardInstance) DashboardInstanceDTO {
	sections := make([]dto.SectionDTO, 0, len(instance.Sections))
	for _, s := range instance.Sections {
		sections = append(sections, dto.FromDashboardSection(s, dto.OwnerDashboardInstance, instance.ID))
	}

	var templateDTO *DashboardTemplateDTO
	if instance.Template.ID != "" {
		d := ConvertTemplateToDTO(instance.Template)
		templateDTO = &d
	}

	return DashboardInstanceDTO{
		ID:              instance.ID,
		TemplateID:      instance.TemplateID,
		TenantID:        instance.TenantID,
		Name:            instance.Name,
		Description:     instance.Description,
		IsPublic:        instance.IsPublic,
		LayoutConfig:    instance.LayoutConfig,
		ColorPalette:    instance.ColorPalette,
		DataSourceID:    instance.DataSourceID,
		RefreshInterval: instance.RefreshInterval,
		AutoRefresh:     instance.AutoRefresh,
		LastRefreshedAt: instance.LastRefreshedAt,
		ViewCount:       instance.ViewCount,
		Template:        templateDTO,
		Sections:        sections,
		CreatedAt:       instance.CreatedAt,
		UpdatedAt:       instance.UpdatedAt,
	}
}

// DashboardTemplateService 大屏模板服务
type DashboardTemplateService struct {
	db *gorm.DB
}

// NewDashboardTemplateService 创建模板服务
func NewDashboardTemplateService(db *gorm.DB) *DashboardTemplateService {
	return &DashboardTemplateService{db: db}
}

// CreateTemplate 创建模板
func (s *DashboardTemplateService) CreateTemplate(template *model.DashboardTemplate) error {
	if template.ID == "" {
		template.ID = uuid.New().String()
	}
	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()

	return s.db.Create(template).Error
}

// UpdateTemplate 更新模板
func (s *DashboardTemplateService) UpdateTemplate(id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()
	return s.db.Model(&model.DashboardTemplate{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteTemplate 删除模板
func (s *DashboardTemplateService) DeleteTemplate(id string) error {
	return s.db.Delete(&model.DashboardTemplate{}, id).Error
}

// GetTemplate 获取模板详情
func (s *DashboardTemplateService) GetTemplate(id string) (*model.DashboardTemplate, error) {
	var template model.DashboardTemplate
	err := s.db.Preload("Sections").First(&template, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &template, nil
}

// ListTemplates 获取模板列表
func (s *DashboardTemplateService) ListTemplates(tenantID string, category string, includeSystem bool) ([]model.DashboardTemplate, error) {
	var templates []model.DashboardTemplate
	query := s.db.Model(&model.DashboardTemplate{})

	// 如果不包含系统模板，只查询用户自定义模板
	if !includeSystem {
		query = query.Where("tenant_id = ?", tenantID)
	} else {
		// 包含系统模板时，查询系统模板 + 用户自定义模板
		query = query.Where("tenant_id = ? OR is_system = ?", tenantID, true)
	}

	if category != "" {
		query = query.Where("category = ?", category)
	}

	err := query.Preload("Sections").Order("is_system DESC, usage_count DESC").Find(&templates).Error
	if err != nil {
		return nil, err
	}
	return templates, nil
}

// GetSystemTemplates 获取系统预置模板
func (s *DashboardTemplateService) GetSystemTemplates() ([]model.DashboardTemplate, error) {
	var templates []model.DashboardTemplate
	err := s.db.Where("is_system = ? AND is_public = ?", true, true).
		Preload("Sections").
		Order("usage_count DESC").
		Find(&templates).Error
	if err != nil {
		return nil, err
	}
	return templates, nil
}

// IncrementUsage 增加模板使用次数
func (s *DashboardTemplateService) IncrementUsage(id string) error {
	return s.db.Model(&model.DashboardTemplate{}).
		Where("id = ?", id).
		UpdateColumn("usage_count", gorm.Expr("usage_count + 1")).Error
}

// CreateDashboardInstance 创建大屏实例
func (s *DashboardTemplateService) CreateDashboardInstance(instance *model.DashboardInstance) error {
	if instance.ID == "" {
		instance.ID = uuid.New().String()
	}
	instance.CreatedAt = time.Now()
	instance.UpdatedAt = time.Now()

	return s.db.Create(instance).Error
}

// GetDashboardInstance 获取大屏实例
func (s *DashboardTemplateService) GetDashboardInstance(id string, tenantID string) (*model.DashboardInstance, error) {
	var instance model.DashboardInstance
	err := s.db.Preload("Template").Preload("Sections").
		First(&instance, "id = ? AND tenant_id = ?", id, tenantID).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

// ListDashboardInstances 获取大屏实例列表
func (s *DashboardTemplateService) ListDashboardInstances(tenantID string) ([]model.DashboardInstance, error) {
	var instances []model.DashboardInstance
	err := s.db.Where("tenant_id = ?", tenantID).
		Preload("Template").
		Order("created_at DESC").
		Find(&instances).Error
	if err != nil {
		return nil, err
	}
	return instances, nil
}

// UpdateDashboardInstance 更新大屏实例
func (s *DashboardTemplateService) UpdateDashboardInstance(id string, tenantID string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()
	return s.db.Model(&model.DashboardInstance{}).
		Where("id = ? AND tenant_id = ?", id, tenantID).
		Updates(updates).Error
}

// DeleteDashboardInstance 删除大屏实例
func (s *DashboardTemplateService) DeleteDashboardInstance(id string, tenantID string) error {
	return s.db.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&model.DashboardInstance{}).Error
}

// CreateSection 创建区块
func (s *DashboardTemplateService) CreateSection(section *model.DashboardSection) error {
	if section.ID == "" {
		section.ID = uuid.New().String()
	}
	section.CreatedAt = time.Now()
	section.UpdatedAt = time.Now()
	return s.db.Create(section).Error
}

// UpdateSection 更新区块
func (s *DashboardTemplateService) UpdateSection(id string, tenantID string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now()
	return s.db.Model(&model.DashboardSection{}).
		Where("id = ? AND tenant_id = ?", id, tenantID).
		Updates(updates).Error
}

// DeleteSection 删除区块
func (s *DashboardTemplateService) DeleteSection(id string, tenantID string) error {
	return s.db.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&model.DashboardSection{}).Error
}

// DeleteSectionsByTemplate 删除模板的所有区块
func (s *DashboardTemplateService) DeleteSectionsByTemplate(templateID string, tenantID string) error {
	return s.db.Where("template_id = ? AND tenant_id = ?", templateID, tenantID).Delete(&model.DashboardSection{}).Error
}

// DeleteSectionsByInstance 删除实例的所有区块
func (s *DashboardTemplateService) DeleteSectionsByInstance(instanceID string, tenantID string) error {
	return s.db.Where("instance_id = ? AND tenant_id = ?", instanceID, tenantID).Delete(&model.DashboardSection{}).Error
}

// GetSectionsByTemplate 获取模板的所有区块
func (s *DashboardTemplateService) GetSectionsByTemplate(templateID string, tenantID string) ([]model.DashboardSection, error) {
	var sections []model.DashboardSection
	err := s.db.Where("template_id = ? AND tenant_id = ?", templateID, tenantID).
		Order("priority ASC, row ASC, col ASC").
		Find(&sections).Error
	if err != nil {
		return nil, err
	}
	return sections, nil
}

// GetSectionsByInstance 获取实例的所有区块
func (s *DashboardTemplateService) GetSectionsByInstance(instanceID string, tenantID string) ([]model.DashboardSection, error) {
	var sections []model.DashboardSection
	err := s.db.Where("instance_id = ? AND tenant_id = ?", instanceID, tenantID).
		Order("priority ASC, row ASC, col ASC").
		Find(&sections).Error
	if err != nil {
		return nil, err
	}
	return sections, nil
}

// InitSystemTemplates 初始化系统预置模板
func (s *DashboardTemplateService) InitSystemTemplates() error {
	// 检查是否已存在系统模板
	var count int64
	err := s.db.Model(&model.DashboardTemplate{}).Where("is_system = ?", true).Count(&count).Error
	if err != nil {
		return err
	}
	if count > 0 {
		return nil // 已存在，跳过初始化
	}

	// 定义预置模板
	templates := []struct {
		category     string
		name         string
		description  string
		icon         string
		tags         []string
		sections     []model.DashboardSection
		layoutConfig string
		colorTone    string
	}{
		{
			category:     "promotion",
			name:         "大促作战大屏",
			description:  "实时监控大促期间的销售数据、转化率和区域表现",
			icon:         "promotion",
			tags:         []string{"大促", "实时监控", "销售"},
			colorTone:    "vibrant",
			layoutConfig: `{"columns": 3, "rows": "auto", "highlight": "top-left", "responsive": true}`,
			sections: []model.DashboardSection{
				{
					Type:     model.SectionTypeKPI,
					Title:    "核心指标",
					Metrics:  `["gmv", "orders", "conversion_rate"]`,
					Row:      0,
					Col:      0,
					Width:    3,
					Height:   1,
					Priority: 1,
				},
				{
					Type:      model.SectionTypeTrend,
					Title:     "销售趋势（小时）",
					Metrics:   `["gmv", "orders"]`,
					TimeGrain: "hour",
					Row:       1,
					Col:       0,
					Width:     2,
					Height:    1,
					Priority:  2,
				},
				{
					Type:     model.SectionTypeRanking,
					Title:    "品类排行",
					Metrics:  `["gmv"]`,
					TopN:     10,
					Row:      1,
					Col:      2,
					Width:    1,
					Height:   1,
					Priority: 3,
				},
				{
					Type:       model.SectionTypeMap,
					Title:      "区域销售地图",
					Metrics:    `["gmv"]`,
					Dimensions: `["province"]`,
					Row:        2,
					Col:        0,
					Width:      2,
					Height:     1,
					Priority:   4,
				},
				{
					Type:         model.SectionTypeAlert,
					Title:        "实时告警",
					AutoGenerate: true,
					Row:          2,
					Col:          2,
					Width:        1,
					Height:       1,
					Priority:     5,
				},
			},
		},
		{
			category:     "operations",
			name:         "经营日报",
			description:  "每日经营状况概览，包含核心指标和趋势分析",
			icon:         "dashboard",
			tags:         []string{"日报", "经营分析", "核心指标"},
			colorTone:    "professional",
			layoutConfig: `{"columns": 3, "rows": "auto", "highlight": "top-left", "responsive": true}`,
			sections: []model.DashboardSection{
				{
					Type:     model.SectionTypeKPI,
					Title:    "核心指标",
					Metrics:  `["gmv", "revenue", "profit"]`,
					Row:      0,
					Col:      0,
					Width:    3,
					Height:   1,
					Priority: 1,
				},
				{
					Type:      model.SectionTypeTrend,
					Title:     "销售趋势（日）",
					Metrics:   `["gmv", "revenue"]`,
					TimeGrain: "day",
					Row:       1,
					Col:       0,
					Width:     2,
					Height:    1,
					Priority:  2,
				},
				{
					Type:     model.SectionTypeFunnel,
					Title:    "转化漏斗",
					Metrics:  `["visitors", "cart_add", "orders", "payments"]`,
					Row:      1,
					Col:      2,
					Width:    1,
					Height:   1,
					Priority: 3,
				},
				{
					Type:         model.SectionTypeInsight,
					Title:        "AI 洞察",
					AutoGenerate: true,
					Row:          2,
					Col:          0,
					Width:        3,
					Height:       1,
					Priority:     4,
				},
			},
		},
		{
			category:     "finance",
			name:         "财务分析大屏",
			description:  "财务健康状况分析，包含收入、成本、利润等核心财务指标",
			icon:         "finance",
			tags:         []string{"财务", "利润分析", "成本"},
			colorTone:    "professional",
			layoutConfig: `{"columns": 3, "rows": "auto", "highlight": "top-left", "responsive": true}`,
			sections: []model.DashboardSection{
				{
					Type:     model.SectionTypeKPI,
					Title:    "财务概览",
					Metrics:  `["revenue", "cost", "profit", "margin"]`,
					Row:      0,
					Col:      0,
					Width:    3,
					Height:   1,
					Priority: 1,
				},
				{
					Type:       model.SectionTypePie,
					Title:      "成本构成",
					Metrics:    `["cost"]`,
					Dimensions: `["cost_category"]`,
					Row:        1,
					Col:        0,
					Width:      2,
					Height:     1,
					Priority:   2,
				},
				{
					Type:      model.SectionTypeBar,
					Title:     "利润趋势（月）",
					Metrics:   `["profit", "margin"]`,
					TimeGrain: "month",
					Row:       1,
					Col:       2,
					Width:     1,
					Height:    1,
					Priority:  3,
				},
				{
					Type:     model.SectionTypeTable,
					Title:    "明细表",
					Metrics:  `["revenue", "cost", "profit"]`,
					Row:      2,
					Col:      0,
					Width:    3,
					Height:   1,
					Priority: 4,
				},
			},
		},
		{
			category:     "channel",
			name:         "渠道效果分析",
			description:  "分析各渠道的获客效果和 ROI",
			icon:         "channel",
			tags:         []string{"渠道", "ROI", "获客"},
			colorTone:    "vibrant",
			layoutConfig: `{"columns": 3, "rows": "auto", "highlight": "top-left", "responsive": true}`,
			sections: []model.DashboardSection{
				{
					Type:     model.SectionTypeKPI,
					Title:    "渠道核心指标",
					Metrics:  `["gmv", "cac", "roi"]`,
					Row:      0,
					Col:      0,
					Width:    3,
					Height:   1,
					Priority: 1,
				},
				{
					Type:       model.SectionTypeBar,
					Title:      "渠道对比",
					Metrics:    `["gmv", "roi"]`,
					Dimensions: `["channel"]`,
					Row:        1,
					Col:        0,
					Width:      2,
					Height:     1,
					Priority:   2,
				},
				{
					Type:      model.SectionTypeTrend,
					Title:     "渠道趋势（周）",
					Metrics:   `["gmv"]`,
					TimeGrain: "week",
					SplitBy:   "channel",
					Row:       1,
					Col:       2,
					Width:     1,
					Height:    1,
					Priority:  3,
				},
			},
		},
		{
			category:     "product",
			name:         "商品分析大屏",
			description:  "商品销售表现和库存分析",
			icon:         "product",
			tags:         []string{"商品", "库存", "销售分析"},
			colorTone:    "minimal",
			layoutConfig: `{"columns": 3, "rows": "auto", "highlight": "top-left", "responsive": true}`,
			sections: []model.DashboardSection{
				{
					Type:     model.SectionTypeKPI,
					Title:    "商品核心指标",
					Metrics:  `["gmv", "units_sold", "inventory_turnover"]`,
					Row:      0,
					Col:      0,
					Width:    3,
					Height:   1,
					Priority: 1,
				},
				{
					Type:     model.SectionTypeRanking,
					Title:    "商品排行（TOP 20）",
					Metrics:  `["gmv", "units_sold"]`,
					TopN:     20,
					Row:      1,
					Col:      0,
					Width:    2,
					Height:   1,
					Priority: 2,
				},
				{
					Type:       model.SectionTypePie,
					Title:      "品类分布",
					Metrics:    `["gmv"]`,
					Dimensions: `["category"]`,
					Row:        1,
					Col:        2,
					Width:      1,
					Height:     1,
					Priority:   3,
				},
				{
					Type:         model.SectionTypeAlert,
					Title:        "库存预警",
					Metrics:      `["inventory_level"]`,
					AutoGenerate: true,
					Row:          2,
					Col:          0,
					Width:        3,
					Height:       1,
					Priority:     4,
				},
			},
		},
	}

	// 创建模板
	for _, t := range templates {
		tagsJSON, _ := json.Marshal(t.tags)
		template := &model.DashboardTemplate{
			ID:           uuid.New().String(),
			Name:         t.name,
			Description:  t.description,
			Category:     t.category,
			Icon:         t.icon,
			IsSystem:     true,
			IsPublic:     true,
			Tags:         string(tagsJSON),
			LayoutConfig: t.layoutConfig,
			ColorTone:    t.colorTone,
			UsageCount:   0,
		}

		if err := s.db.Create(template).Error; err != nil {
			return fmt.Errorf("创建模板失败 [%s]: %w", t.name, err)
		}

		// 创建区块
		for i := range t.sections {
			t.sections[i].ID = uuid.New().String()
			t.sections[i].CreatedAt = time.Now()
			t.sections[i].UpdatedAt = time.Now()
			// 关联到模板（不设置 TenantID，系统模板属于所有租户）
			t.sections[i].TemplateID = template.ID
			if err := s.db.Create(&t.sections[i]).Error; err != nil {
				return fmt.Errorf("创建区块失败 [%s]: %w", t.sections[i].Title, err)
			}
		}
	}

	return nil
}

// GenerateDashboardFromTemplate 基于模板生成大屏实例
func (s *DashboardTemplateService) GenerateDashboardFromTemplate(
	templateID string,
	tenantID string,
	dataSourceID string,
	name string,
) (*model.DashboardInstance, error) {
	// 获取模板
	template, err := s.GetTemplate(templateID)
	if err != nil {
		return nil, errors.New("模板不存在")
	}

	// 创建实例
	instance := &model.DashboardInstance{
		TemplateID:      templateID,
		TenantID:        tenantID,
		DataSourceID:    dataSourceID,
		Name:            name,
		Description:     template.Description,
		LayoutConfig:    template.LayoutConfig,
		ColorPalette:    template.ColorPalette,
		AutoRefresh:     true,
		RefreshInterval: 300,
	}

	if err := s.CreateDashboardInstance(instance); err != nil {
		return nil, err
	}

	// 复制区块
	for _, section := range template.Sections {
		newSection := section
		newSection.ID = uuid.New().String()
		newSection.TenantID = tenantID
		newSection.TemplateID = "" // 清空模板 ID
		newSection.InstanceID = instance.ID
		newSection.CreatedAt = time.Now()
		newSection.UpdatedAt = time.Now()

		if err := s.CreateSection(&newSection); err != nil {
			// 回滚
			s.DeleteDashboardInstance(instance.ID, tenantID)
			return nil, err
		}
	}

	// 增加模板使用次数
	s.IncrementUsage(templateID)

	return instance, nil
}
