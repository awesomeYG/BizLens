package service

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"ai-bi-server/internal/model"
	"gorm.io/gorm"
)

// MetricService 指标服务
type MetricService struct {
	db *gorm.DB
}

func NewMetricService(db *gorm.DB) *MetricService {
	return &MetricService{db: db}
}

// CreateMetric 创建指标
func (s *MetricService) CreateMetric(metric *model.Metric) error {
	// 解析标签
	if metric.Tags != "" {
		var tags []string
		if err := json.Unmarshal([]byte(metric.Tags), &tags); err != nil {
			return fmt.Errorf("invalid tags format: %v", err)
		}
	}

	// 解析依赖指标
	if metric.DependentMetrics != "" {
		var deps []string
		if err := json.Unmarshal([]byte(metric.DependentMetrics), &deps); err != nil {
			return fmt.Errorf("invalid dependentMetrics format: %v", err)
		}
	}

	return s.db.Create(metric).Error
}

// UpdateMetric 更新指标
func (s *MetricService) UpdateMetric(id string, updates map[string]interface{}) error {
	return s.db.Model(&model.Metric{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteMetric 删除指标（软删除）
func (s *MetricService) DeleteMetric(id string) error {
	return s.db.Delete(&model.Metric{}, id).Error
}

// GetMetric 获取单个指标
func (s *MetricService) GetMetric(id string) (*model.Metric, error) {
	var metric model.Metric
	err := s.db.First(&metric, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &metric, nil
}

// ListMetrics 获取指标列表
func (s *MetricService) ListMetrics(tenantID string, category string, status string) ([]model.Metric, error) {
	var metrics []model.Metric
	query := s.db.Where("tenant_id = ?", tenantID)

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Order("created_at DESC").Find(&metrics).Error
	return metrics, err
}

// AutoDiscoverMetrics AI 自动发现指标
func (s *MetricService) AutoDiscoverMetrics(tenantID string, dataSourceID string) ([]model.Metric, error) {
	// 获取数据源
	var dataSource model.DataSource
	if err := s.db.First(&dataSource, "id = ? AND tenant_id = ?", dataSourceID, tenantID).Error; err != nil {
		return nil, fmt.Errorf("data source not found: %v", err)
	}

	// 解析表结构信息（使用 SchemaInfo）
	var schemaInfo map[string]interface{}
	if err := json.Unmarshal([]byte(dataSource.SchemaInfo), &schemaInfo); err != nil {
		return nil, fmt.Errorf("failed to parse schema info: %v", err)
	}

	// 获取表结构映射：structure[tableName] = columns
	structure, ok := schemaInfo["structure"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("schema info missing structure field")
	}

	metrics := []model.Metric{}

	// 分析表结构，自动发现指标
	for tableName, columns := range structure {
		columnList, ok := columns.([]interface{})
		if !ok {
			continue
		}

		// 遍历列，识别潜在的指标字段
		for _, col := range columnList {
			colInfo, ok := col.(map[string]interface{})
			if !ok {
				continue
			}

			colName, _ := colInfo["field"].(string)
			colType, _ := colInfo["type"].(string)

			// 识别金额字段
			if isAmountField(colName, colType) {
				metric := s.createAutoMetric(tenantID, tableName, colName, "GMV", model.MetricTypeCurrency, model.AggSum, 0.9)
				metrics = append(metrics, metric)
			}

			// 识别数量字段
			if isQuantityField(colName, colType) {
				metric := s.createAutoMetric(tenantID, tableName, colName, "数量", model.MetricTypeNumber, model.AggSum, 0.8)
				metrics = append(metrics, metric)
			}
		}

		// 识别计数指标（基于表名）
		if isTransactionTable(tableName) {
			metric := s.createAutoMetric(tenantID, tableName, "id", "订单量", model.MetricTypeNumber, model.AggCount, 0.85)
			metrics = append(metrics, metric)
		}
	}

	return metrics, nil
}

// createAutoMetric 创建自动发现的指标
func (s *MetricService) createAutoMetric(
	tenantID, tableName, fieldName, displayName string,
	dataType model.MetricDataType,
	aggregation model.MetricAggregation,
	confidence float64,
) model.Metric {
	// 生成公式
	formula := fmt.Sprintf("%s(%s.%s)", strings.ToUpper(string(aggregation)), tableName, fieldName)

	return model.Metric{
		ID:              generateID("metric"),
		TenantID:        tenantID,
		Name:            strings.ToUpper(fieldName),
		DisplayName:     displayName,
		Description:     fmt.Sprintf("AI 自动发现：%s 的 %s", tableName, displayName),
		DataType:        dataType,
		Aggregation:     aggregation,
		Formula:         formula,
		BaseTable:       tableName,
		BaseField:       fieldName,
		IsAutoDetected:  true,
		ConfidenceScore: confidence,
		Status:          "draft", // 自动发现的指标默认为草稿状态，需要用户确认
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
}

// GetMetricLineage 获取指标血缘
func (s *MetricService) GetMetricLineage(metricID string) (*model.MetricLineage, error) {
	var lineage model.MetricLineage
	err := s.db.First(&lineage, "metric_id = ?", metricID).Error
	if err != nil {
		return nil, err
	}
	return &lineage, nil
}

// UpdateMetricLineage 更新指标血缘（使用指标时调用）
func (s *MetricService) UpdateMetricLineage(metricID string) error {
	lineage, err := s.GetMetricLineage(metricID)
	if err == nil {
		// 更新现有血缘
		lineage.UsageCount++
		now := time.Now()
		lineage.LastUsedAt = &now
		return s.db.Save(lineage).Error
	}

	// 创建新的血缘记录（如果没有）
	return nil
}

// 辅助函数：判断是否为金额字段
func isAmountField(colName, colType string) bool {
	amountPatterns := []string{"amount", "price", "cost", "fee", "money", "revenue", "gmv", "sales"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range amountPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	// 检查数值类型
	numericTypes := []string{"decimal", "numeric", "money", "float", "double"}
	for _, t := range numericTypes {
		if strings.Contains(strings.ToLower(colType), t) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为数量字段
func isQuantityField(colName, colType string) bool {
	quantityPatterns := []string{"quantity", "qty", "count", "num", "amount"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range quantityPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为交易表
func isTransactionTable(tableName string) bool {
	transactionPatterns := []string{"order", "transaction", "payment", "sale", "purchase"}
	lowerName := strings.ToLower(tableName)

	for _, pattern := range transactionPatterns {
		if strings.Contains(lowerName, pattern) || strings.HasSuffix(lowerName, "s") {
			return true
		}
	}

	return false
}

// generateID 生成 ID（简单实现，生产环境应该用 UUID）
func generateID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

// DimensionService 维度服务
type DimensionService struct {
	db *gorm.DB
}

func NewDimensionService(db *gorm.DB) *DimensionService {
	return &DimensionService{db: db}
}

// AutoDiscoverDimensions AI 自动发现维度
func (s *DimensionService) AutoDiscoverDimensions(tenantID string, dataSourceID string) ([]model.Dimension, error) {
	// 获取数据源
	var dataSource model.DataSource
	if err := s.db.First(&dataSource, "id = ? AND tenant_id = ?", dataSourceID, tenantID).Error; err != nil {
		return nil, fmt.Errorf("data source not found: %v", err)
	}

	// 解析表结构信息（使用 SchemaInfo）
	var schemaInfo map[string]interface{}
	if err := json.Unmarshal([]byte(dataSource.SchemaInfo), &schemaInfo); err != nil {
		return nil, fmt.Errorf("failed to parse schema info: %v", err)
	}

	// 获取表结构映射：structure[tableName] = columns
	structure, ok := schemaInfo["structure"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("schema info missing structure field")
	}

	dimensions := []model.Dimension{}

	// 分析表结构，自动发现维度
	for tableName, columns := range structure {
		columnList, ok := columns.([]interface{})
		if !ok {
			continue
		}

		for _, col := range columnList {
			colInfo, ok := col.(map[string]interface{})
			if !ok {
				continue
			}

			colName, _ := colInfo["field"].(string)
			colType, _ := colInfo["type"].(string)

			// 识别时间维度
			if isTimeField(colName, colType) {
				dim := s.createAutoDimension(tenantID, tableName, colName, "时间", model.DimTypeTime, 0.9)
				dimensions = append(dimensions, dim)
			}

			// 识别分类维度
			if isCategoryField(colName, colType) {
				dim := s.createAutoDimension(tenantID, tableName, colName, "分类", model.DimTypeCategory, 0.8)
				dimensions = append(dimensions, dim)
			}

			// 识别地理维度
			if isGeoField(colName) {
				dim := s.createAutoDimension(tenantID, tableName, colName, "地域", model.DimTypeGeo, 0.85)
				dimensions = append(dimensions, dim)
			}
		}
	}

	return dimensions, nil
}

// createAutoDimension 创建自动发现的维度
func (s *DimensionService) createAutoDimension(
	tenantID, tableName, fieldName, displayName string,
	dataType model.DimensionType,
	confidence float64,
) model.Dimension {
	return model.Dimension{
		ID:             generateID("dim"),
		TenantID:       tenantID,
		Name:           fieldName,
		DisplayName:    displayName,
		Description:    fmt.Sprintf("AI 自动发现：%s 的 %s", tableName, displayName),
		DataType:       dataType,
		BaseTable:      tableName,
		BaseField:      fieldName,
		IsAutoDetected: true,
		Status:         "draft",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
}

// 辅助函数：判断是否为时间字段
func isTimeField(colName, colType string) bool {
	timePatterns := []string{"date", "time", "created", "updated", "start", "end", "at"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range timePatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	timeTypes := []string{"date", "time", "timestamp", "datetime"}
	for _, t := range timeTypes {
		if strings.Contains(strings.ToLower(colType), t) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为分类字段
func isCategoryField(colName, colType string) bool {
	categoryPatterns := []string{"type", "category", "status", "level", "name", "title"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range categoryPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	// 字符串类型可能是分类
	stringTypes := []string{"varchar", "char", "text", "string"}
	for _, t := range stringTypes {
		if strings.Contains(strings.ToLower(colType), t) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为地理字段
func isGeoField(colName string) bool {
	geoPatterns := []string{"province", "city", "district", "country", "region", "address", "location"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range geoPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// RelationshipService 关系服务
type RelationshipService struct {
	db *gorm.DB
}

func NewRelationshipService(db *gorm.DB) *RelationshipService {
	return &RelationshipService{db: db}
}

// AutoDiscoverRelationships AI 自动发现表关系
func (s *RelationshipService) AutoDiscoverRelationships(tenantID string, dataSourceID string) ([]model.Relationship, error) {
	// 获取数据源
	var dataSource model.DataSource
	if err := s.db.First(&dataSource, "id = ? AND tenant_id = ?", dataSourceID, tenantID).Error; err != nil {
		return nil, fmt.Errorf("data source not found: %v", err)
	}

	// 解析表结构信息（使用 SchemaInfo）
	var schemaInfo map[string]interface{}
	if err := json.Unmarshal([]byte(dataSource.SchemaInfo), &schemaInfo); err != nil {
		return nil, fmt.Errorf("failed to parse schema info: %v", err)
	}

	// 获取表名列表
	tablesRaw, _ := schemaInfo["tables"].([]interface{})
	tables := make([]string, 0, len(tablesRaw))
	for _, t := range tablesRaw {
		if name, ok := t.(string); ok {
			tables = append(tables, name)
		}
	}

	// 获取表结构映射
	structure, _ := schemaInfo["structure"].(map[string]interface{})

	relationships := []model.Relationship{}

	// 分析表之间的关系
	for i, table1 := range tables {
		for j, table2 := range tables {
			if i >= j {
				continue
			}

			// 尝试发现外键关系
			if rel, found := s.findForeignKeyRelationship(tenantID, table1, table2, structure); found {
				relationships = append(relationships, rel)
			}
		}
	}

	return relationships, nil
}

// findForeignKeyRelationship 查找两个表之间的外键关系
func (s *RelationshipService) findForeignKeyRelationship(
	tenantID, table1, table2 string,
	tableInfo map[string]interface{},
) (model.Relationship, bool) {
	// 简化实现：基于命名约定发现关系
	// 例如：orders.user_id -> users.id

	commonFKPatterns := []string{"user_id", "customer_id", "product_id", "order_id", "category_id"}

	columns1, _ := tableInfo[table1].([]interface{})
	columns2, _ := tableInfo[table2].([]interface{})

	for _, pattern := range commonFKPatterns {
		// 检查 table1 是否有 pattern 字段
		hasInTable1 := hasColumn(columns1, pattern)
		// 检查 table2 是否有 id 字段
		hasInTable2 := hasColumn(columns2, "id")

		if hasInTable1 && hasInTable2 {
			return model.Relationship{
				ID:              generateID("rel"),
				TenantID:        tenantID,
				Name:            fmt.Sprintf("%s-%s", table1, table2),
				Description:     fmt.Sprintf("AI 自动发现：%s.%s -> %s.id", table1, pattern, table2),
				SourceTable:     table1,
				TargetTable:     table2,
				Relationship:    model.RelManyToOne,
				JoinKey:         pattern,
				TargetKey:       "id",
				IsAutoDetected:  true,
				ConfidenceScore: 0.85,
				Status:          "draft",
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			}, true
		}

		// 反向检查
		hasInTable2 = hasColumn(columns2, pattern)
		hasInTable1 = hasColumn(columns1, "id")

		if hasInTable2 && hasInTable1 {
			return model.Relationship{
				ID:              generateID("rel"),
				TenantID:        tenantID,
				Name:            fmt.Sprintf("%s-%s", table2, table1),
				Description:     fmt.Sprintf("AI 自动发现：%s.%s -> %s.id", table2, pattern, table1),
				SourceTable:     table2,
				TargetTable:     table1,
				Relationship:    model.RelManyToOne,
				JoinKey:         pattern,
				TargetKey:       "id",
				IsAutoDetected:  true,
				ConfidenceScore: 0.85,
				Status:          "draft",
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			}, true
		}
	}

	return model.Relationship{}, false
}

// hasColumn 检查列是否存在
func hasColumn(columns []interface{}, columnName string) bool {
	for _, col := range columns {
		colInfo, ok := col.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := colInfo["name"].(string)
		if name == columnName {
			return true
		}
	}
	return false
}
