package service

import (
	"fmt"
	"regexp"
	"strings"

	"ai-bi-server/internal/model"
	"gorm.io/gorm"
)

// SemanticQueryService 语义层查询服务
type SemanticQueryService struct {
	db                  *gorm.DB
	metricService       *MetricService
	dimensionService    *DimensionService
	relationshipService *RelationshipService
}

func NewSemanticQueryService(
	db *gorm.DB,
	metricService *MetricService,
	dimensionService *DimensionService,
	relationshipService *RelationshipService,
) *SemanticQueryService {
	return &SemanticQueryService{
		db:                  db,
		metricService:       metricService,
		dimensionService:    dimensionService,
		relationshipService: relationshipService,
	}
}

// ResolveMetricToSQL 将指标名称解析为 SQL 片段
func (s *SemanticQueryService) ResolveMetricToSQL(tenantID, metricName string) (string, error) {
	// 查找指标
	metrics, err := s.metricService.ListMetrics(tenantID, "", "active")
	if err != nil {
		return "", err
	}

	// 精确匹配
	for _, metric := range metrics {
		if strings.EqualFold(metric.Name, metricName) || strings.EqualFold(metric.DisplayName, metricName) {
			return metric.Formula, nil
		}
	}

	// 模糊匹配
	for _, metric := range metrics {
		if strings.Contains(strings.ToLower(metric.DisplayName), strings.ToLower(metricName)) {
			return metric.Formula, nil
		}
	}

	return "", fmt.Errorf("metric not found: %s", metricName)
}

// ResolveDimensionToSQL 将维度名称解析为 SQL 字段
func (s *SemanticQueryService) ResolveDimensionToSQL(tenantID, dimensionName string) (string, error) {
	// TODO: 实现维度解析
	dimensions, err := s.dimensionService.AutoDiscoverDimensions(tenantID, "")
	if err != nil {
		return "", err
	}

	for _, dim := range dimensions {
		if strings.EqualFold(dim.Name, dimensionName) || strings.EqualFold(dim.DisplayName, dimensionName) {
			return fmt.Sprintf("%s.%s", dim.BaseTable, dim.BaseField), nil
		}
	}

	return "", fmt.Errorf("dimension not found: %s", dimensionName)
}

// TranslateNLToSQL 将自然语言查询翻译为 SQL（使用语义层）
func (s *SemanticQueryService) TranslateNLToSQL(tenantID, nlQuery string, dataSourceID string) (string, error) {
	// 获取所有活跃指标
	metrics, err := s.metricService.ListMetrics(tenantID, "", "active")
	if err != nil {
		return "", err
	}

	// 创建指标映射
	metricMap := make(map[string]model.Metric)
	for _, metric := range metrics {
		metricMap[strings.ToLower(metric.Name)] = metric
		metricMap[strings.ToLower(metric.DisplayName)] = metric
	}

	// 识别查询中的指标
	var selectedMetrics []model.Metric
	for key, metric := range metricMap {
		if strings.Contains(strings.ToLower(nlQuery), key) {
			selectedMetrics = append(selectedMetrics, metric)
		}
	}

	if len(selectedMetrics) == 0 {
		return "", fmt.Errorf("no metrics found in query")
	}

	// 构建 SQL
	// 简化实现：假设单表查询
	baseTable := selectedMetrics[0].BaseTable

	// SELECT 子句
	selectParts := []string{}
	for _, metric := range selectedMetrics {
		selectParts = append(selectParts, fmt.Sprintf("%s AS %s", metric.Formula, metric.Name))
	}
	selectClause := strings.Join(selectParts, ", ")

	// WHERE 子句（简单时间范围识别）
	whereClauses := []string{}

	// 识别时间关键词
	timePatterns := map[string]string{
		`今天|今日`: "DATE(created_at) = CURDATE()",
		`昨天|昨日`: "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
		`本周`:    "YEARWEEK(created_at) = YEARWEEK(NOW())",
		`上周`:    "YEARWEEK(created_at) = YEARWEEK(NOW() - INTERVAL 1 WEEK)",
		`本月`:    "MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())",
		`上月`:    "MONTH(created_at) = MONTH(NOW() - INTERVAL 1 MONTH) AND YEAR(created_at) = YEAR(NOW())",
	}

	for pattern, condition := range timePatterns {
		matched, _ := regexp.MatchString(pattern, nlQuery)
		if matched {
			whereClauses = append(whereClauses, condition)
		}
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// 构建最终 SQL
	sql := fmt.Sprintf("SELECT %s FROM %s %s", selectClause, baseTable, whereClause)

	return sql, nil
}

// GetMetricContext 获取指标的上下文信息（用于 AI prompt）
func (s *SemanticQueryService) GetMetricContext(tenantID string) (string, error) {
	metrics, err := s.metricService.ListMetrics(tenantID, "", "active")
	if err != nil {
		return "", err
	}

	context := "可用的业务指标：\n"
	for _, metric := range metrics {
		context += fmt.Sprintf(
			"- %s (%s): %s\n  公式：%s\n  描述：%s\n",
			metric.DisplayName,
			metric.Name,
			metric.Description,
			metric.Formula,
			metric.Description,
		)
	}

	return context, nil
}

// ValidateMetricUsage 验证指标使用是否正确
func (s *SemanticQueryService) ValidateMetricUsage(tenantID, metricID, sql string) error {
	metric, err := s.metricService.GetMetric(metricID)
	if err != nil {
		return err
	}

	// 检查 SQL 中是否包含指标公式
	if !strings.Contains(sql, metric.Formula) {
		return fmt.Errorf("SQL does not contain metric formula")
	}

	return nil
}

// UpdateMetricLineageOnUse 更新指标使用血缘
func (s *SemanticQueryService) UpdateMetricLineageOnUse(tenantID, metricID string) error {
	// 查找现有血缘
	var lineage model.MetricLineage
	err := s.db.Where("metric_id = ?", metricID).First(&lineage).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新血缘
		lineage = model.MetricLineage{
			ID:         generateID("lineage"),
			TenantID:   tenantID,
			MetricID:   metricID,
			SourceType: "query",
			UsageCount: 1,
		}
		return s.db.Create(&lineage).Error
	} else if err != nil {
		return err
	}

	// 更新现有血缘
	lineage.UsageCount++
	return s.db.Save(&lineage).Error
}

// ExecuteSemanticQuery 执行语义查询
type QueryResult struct {
	Columns  []string                 `json:"columns"`
	Data     []map[string]interface{} `json:"data"`
	Metrics  []string                 `json:"metrics"`  // 使用的指标
	SQL      string                   `json:"sql"`      // 生成的 SQL
	Duration int64                    `json:"duration"` // 执行时间 (ms)
}

func (s *SemanticQueryService) ExecuteSemanticQuery(
	tenantID, nlQuery string,
	dataSourceID string,
) (*QueryResult, error) {
	// 1. 翻译 NL 到 SQL
	sql, err := s.TranslateNLToSQL(tenantID, nlQuery, dataSourceID)
	if err != nil {
		return nil, err
	}

	// 2. 获取数据源
	var dataSource model.DataSource
	if err := s.db.First(&dataSource, "id = ? AND tenant_id = ?", dataSourceID, tenantID).Error; err != nil {
		return nil, fmt.Errorf("data source not found")
	}

	// 3. 执行 SQL（简化实现，实际应该使用 DataSourceService）
	// 这里只是示例，实际需要连接数据库执行

	// 4. 更新指标血缘
	// 识别 SQL 中使用的指标并更新血缘

	return &QueryResult{
		Columns:  []string{"result"},
		Data:     []map[string]interface{}{{"value": 0}},
		Metrics:  []string{},
		SQL:      sql,
		Duration: 0,
	}, nil
}
