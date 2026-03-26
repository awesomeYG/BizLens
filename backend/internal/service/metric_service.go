package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"ai-bi-server/internal/model"
	"github.com/google/uuid"
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
// 优先使用已存储的 AI 分析结果，仅在没有 AI 分析时 fallback 到规则匹配
func (s *MetricService) AutoDiscoverMetrics(tenantID string, dataSourceID string) ([]model.Metric, error) {
	// 获取数据源
	var dataSource model.DataSource
	if err := s.db.First(&dataSource, "id = ? AND tenant_id = ?", dataSourceID, tenantID).Error; err != nil {
		// 让上层能用 errors.Is(err, gorm.ErrRecordNotFound) 判断 404
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("data source not found: %w", err)
		}
		return nil, fmt.Errorf("failed to load data source: %w", err)
	}

	if strings.TrimSpace(dataSource.SchemaInfo) == "" {
		return nil, fmt.Errorf("data source schema info is empty; please sync schema first")
	}

	metrics := []model.Metric{}
	seen := make(map[string]bool) // 去重：key = "tableName:fieldName:aggregation"

	// ========== 优先：使用已存储的 AI 分析结果 ==========
	if dataSource.AIAnalysis != "" {
		analysis, err := DeserializeAIAnalysis(dataSource.AIAnalysis)
		if err == nil && analysis != nil && len(analysis.Recommendations) > 0 {
			for _, rec := range analysis.Recommendations {
				agg := model.MetricAggregation(strings.ToUpper(rec.Aggregation))
				key := fmt.Sprintf("%s:%s:%s", rec.Table, rec.Field, agg)
				if seen[key] {
					continue
				}
				seen[key] = true

				dataType := model.MetricDataType("number")
				if rec.DataType == "currency" {
					dataType = model.MetricTypeCurrency
				} else if rec.DataType == "ratio" {
					dataType = model.MetricTypeNumber
				}

				metric := s.createAutoMetric(
					tenantID, dataSourceID, rec.Table, rec.Field,
					rec.DisplayName, dataType, agg, rec.Confidence,
				)
				metric.Description = fmt.Sprintf("AI 分析推荐（置信度 %.0f%%）：%s", rec.Confidence*100, rec.Reason)
				metrics = append(metrics, metric)
			}
			// AI 分析结果已生成指标，直接返回
			for _, metric := range metrics {
				if err := s.CreateMetric(&metric); err != nil {
					return nil, fmt.Errorf("failed to save auto-discovered metric %s: %v", metric.Name, err)
				}
			}
			return metrics, nil
		}
	}

	// ========== Fallback：使用规则匹配 ==========
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

			// 跳过纯技术字段
			if isTechnicalField(colName, colType) {
				continue
			}

			// 识别金额字段
			if isAmountField(colName, colType) {
				agg := model.AggSum
				key := fmt.Sprintf("%s:%s:%s", tableName, colName, agg)
				if !seen[key] {
					seen[key] = true
					displayName := inferAmountDisplayName(colName)
					metric := s.createAutoMetric(tenantID, dataSourceID, tableName, colName, displayName, model.MetricTypeCurrency, agg, 0.9)
					metric.Description = fmt.Sprintf("规则匹配发现：%s 的 %s（建议：接入数据源后 AI 将自动分析更准确的语义）", tableName, displayName)
					metrics = append(metrics, metric)
				}
			}

			// 识别数量字段（只对非金额字段创建，避免重复）
			if isQuantityField(colName) && !isAmountField(colName, colType) {
				agg := model.AggSum
				key := fmt.Sprintf("%s:%s:%s", tableName, colName, agg)
				if !seen[key] {
					seen[key] = true
					displayName := inferQuantityDisplayName(colName)
					metric := s.createAutoMetric(tenantID, dataSourceID, tableName, colName, displayName, model.MetricTypeNumber, agg, 0.8)
					metric.Description = fmt.Sprintf("规则匹配发现：%s 的 %s（建议：接入数据源后 AI 将自动分析更准确的语义）", tableName, displayName)
					metrics = append(metrics, metric)
				}
			}

			// 识别唯一计数指标（如用户数、产品数）
			if isCountableField(colName, colType) {
				agg := model.AggCount
				key := fmt.Sprintf("%s:%s:%s", tableName, colName, agg)
				if !seen[key] {
					seen[key] = true
					displayName := inferCountDisplayName(tableName, colName)
					metric := s.createAutoMetric(tenantID, dataSourceID, tableName, colName, displayName, model.MetricTypeNumber, agg, 0.75)
					metrics = append(metrics, metric)
				}
			}
		}

		// 识别计数指标（基于表名，只有被明确识别为业务表时才创建）
		if isStrictTransactionTable(tableName) {
			idCol := findPrimaryKeyColumn(columnList)
			if idCol != "" {
				agg := model.AggCount
				key := fmt.Sprintf("%s:%s:%s", tableName, idCol, agg)
				if !seen[key] {
					seen[key] = true
					displayName := inferTableCountDisplayName(tableName)
					metric := s.createAutoMetric(tenantID, dataSourceID, tableName, idCol, displayName, model.MetricTypeNumber, agg, 0.85)
					metrics = append(metrics, metric)
				}
			}
		}
	}

	// 将发现的指标保存到数据库
	for _, metric := range metrics {
		if err := s.CreateMetric(&metric); err != nil {
			return nil, fmt.Errorf("failed to save auto-discovered metric %s: %v", metric.Name, err)
		}
	}

	return metrics, nil
}

// createAutoMetric 创建自动发现的指标
func (s *MetricService) createAutoMetric(
	tenantID, dataSourceID, tableName, fieldName, displayName string,
	dataType model.MetricDataType,
	aggregation model.MetricAggregation,
	confidence float64,
) model.Metric {
	// 生成公式
	formula := fmt.Sprintf("%s(%s.%s)", strings.ToUpper(string(aggregation)), tableName, fieldName)

	return model.Metric{
		ID:              generateID("metric"),
		TenantID:        tenantID,
		DataSourceID:    dataSourceID,
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

// 辅助函数：判断是否为金额字段（仅基于字段名识别，不无差别匹配所有 numeric 类型）
func isAmountField(colName, colType string) bool {
	// 明确的金额相关关键词
	amountPatterns := []string{"amount", "price", "cost", "fee", "money", "revenue", "gmv", "sales", "total", "subtotal", "discount", "tax", "profit", "margin"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range amountPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为数量字段（仅基于字段名，排除与金额重叠的字段）
func isQuantityField(colName string) bool {
	// 仅保留明确的数量关键词，去掉了与金额重复的 "amount"
	quantityPatterns := []string{"quantity", "qty", "num", "cnt", "pieces", "units"}
	lowerName := strings.ToLower(colName)

	// 排除纯数字列名（如 id、row_no、page_num 等无业务意义的编号）
	pureNumberPatterns := []string{"_id", "_no", "_num$", "_code", "_seq", "_index", "_sort", "_order", "_uid", "_uuid", "_token", "_flag"}
	for _, pattern := range pureNumberPatterns {
		if pattern[len(pattern)-1] == '$' {
			// 正则风格：匹配字段末尾
			prefix := pattern[:len(pattern)-1]
			if strings.HasSuffix(lowerName, prefix) && !strings.Contains(lowerName[:len(lowerName)-len(prefix)], "_") {
				return false
			}
		} else if strings.HasSuffix(lowerName, pattern) {
			return false
		}
	}

	for _, pattern := range quantityPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为可计数字段（用于 COUNT 聚合）
func isCountableField(colName, colType string) bool {
	// 只有明确的用户/客户/会员/产品等核心实体表的主键/唯一字段才适合 COUNT
	countablePatterns := []string{"user", "customer", "member", "product", "item", "sku", "category", "brand", "region", "city"}
	lowerName := strings.ToLower(colName)

	for _, pattern := range countablePatterns {
		if strings.Contains(lowerName, pattern) && strings.Contains(lowerName, "id") {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为交易表（宽松匹配，用于预判）
func isTransactionTable(tableName string) bool {
	transactionPatterns := []string{"order", "transaction", "payment", "sale", "purchase", "invoice", "refund", "return"}
	lowerName := strings.ToLower(tableName)

	for _, pattern := range transactionPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// 辅助函数：严格判断是否为业务主表（用于决定是否创建 COUNT 指标）
// 只有表名包含明确的业务核心实体关键词才认为是主表
func isStrictTransactionTable(tableName string) bool {
	strictPatterns := []string{"order", "transaction", "payment", "invoice", "refund", "return", "subscription"}
	lowerName := strings.ToLower(tableName)

	for _, pattern := range strictPatterns {
		if strings.Contains(lowerName, pattern) {
			return true
		}
	}

	return false
}

// 辅助函数：判断是否为纯技术字段（应被排除，不作为指标来源）
func isTechnicalField(colName, colType string) bool {
	lowerName := strings.ToLower(colName)

	// 纯技术字段名模式
	technicalPatterns := []string{
		"_id", "_at", "_by", "_time", "_status", "_flag", "_type",
		"created_at", "updated_at", "deleted_at", "created_by", "updated_by",
		"is_deleted", "is_active", "is_enabled", "is_valid", "is_visible",
		"version", "sort_order", "sort", "display_order", "priority", "weight",
		"latitude", "longitude", // 经纬度是维度，不是指标
		"ip_address", "mac_address", "device_id", "session_id", "token",
		"password", "salt", "secret", "api_key", "access_token",
		"md5", "sha1", "sha256", // 哈希字段无业务意义
		"remark", "memo", "note", "description", "avatar", "icon", "image", "url", "link",
		"latitude", "longitude", "lng", "lat",
		"extension", "metadata", "config", "settings", "properties",
		"parent_id", "root_id", "path", "level", "depth", "tree_path",
		"is_default", "is_system", "is_anonymous", "is_test",
	}

	for _, pattern := range technicalPatterns {
		if strings.EqualFold(lowerName, pattern) || strings.HasSuffix(lowerName, pattern) {
			return true
		}
	}

	// 跳过所有时间戳类型的 "技术型" 字段（但保留 date 结尾的有意义日期如 birth_date）
	timeSuffixes := []string{"_created_at", "_updated_at", "_deleted_at", "_at$"}
	for _, suffix := range timeSuffixes {
		if strings.HasSuffix(lowerName, suffix[:len(suffix)-1]) {
			return true
		}
	}

	return false
}

// 辅助函数：根据金额字段名推断中文展示名
func inferAmountDisplayName(colName string) string {
	lowerName := strings.ToLower(colName)

	nameMap := map[string]string{
		"amount":             "支付金额",
		"price":              "单价",
		"cost":               "成本",
		"fee":                "手续费",
		"money":              "金额",
		"revenue":            "收入",
		"gmv":                "GMV",
		"sales":              "销售额",
		"total":              "总计",
		"subtotal":           "小计",
		"discount":           "折扣金额",
		"tax":                "税额",
		"profit":             "利润",
		"margin":             "毛利",
		"order_amount":       "订单金额",
		"order_price":        "订单价格",
		"payment_amount":     "支付金额",
		"final_amount":       "实付金额",
		"original_amount":    "原价",
		"refund_amount":      "退款金额",
		"shipping_amount":    "运费",
		"shipping_fee":       "运费",
		"coupon_amount":      "优惠金额",
		"discount_amount":    "优惠金额",
		"product_price":      "商品价格",
		"sale_price":         "售价",
		"sale_amount":        "销售额",
		"gross_amount":       "总额",
		"net_amount":         "净金额",
		"transaction_amount": "交易金额",
	}

	// 精确匹配优先
	if name, ok := nameMap[lowerName]; ok {
		return name
	}

	// 前缀匹配（如 order_amount -> 订单金额）
	prefixes := []string{"order_", "payment_", "refund_", "shipping_", "product_", "sale_", "coupon_", "discount_"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(lowerName, prefix) {
			suffix := strings.TrimPrefix(lowerName, prefix)
			suffixName := inferAmountDisplayName(suffix)
			if suffixName != "" {
				return suffixName
			}
			// 回退到字段名
			return colName
		}
	}

	// 默认返回原始字段名
	return colName
}

// 辅助函数：根据数量字段名推断中文展示名
func inferQuantityDisplayName(colName string) string {
	lowerName := strings.ToLower(colName)

	nameMap := map[string]string{
		"quantity":    "数量",
		"qty":         "数量",
		"num":         "数量",
		"cnt":         "数量",
		"pieces":      "件数",
		"units":       "单位数",
		"order_num":   "订单数量",
		"product_num": "商品数量",
		"item_num":    "商品项数",
		"sku_num":     "SKU数",
	}

	if name, ok := nameMap[lowerName]; ok {
		return name
	}

	prefixes := []string{"order_", "product_", "item_"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(lowerName, prefix) {
			suffix := strings.TrimPrefix(lowerName, prefix)
			suffixName := inferQuantityDisplayName(suffix)
			if suffixName != "" {
				return suffixName
			}
			return colName
		}
	}

	return colName
}

// 辅助函数：根据计数字段推断展示名
func inferCountDisplayName(tableName, colName string) string {
	lowerTable := strings.ToLower(tableName)
	lowerCol := strings.ToLower(colName)

	if strings.Contains(lowerCol, "user") || strings.Contains(lowerTable, "user") {
		return "用户数"
	}
	if strings.Contains(lowerCol, "customer") || strings.Contains(lowerTable, "customer") {
		return "客户数"
	}
	if strings.Contains(lowerCol, "member") || strings.Contains(lowerTable, "member") {
		return "会员数"
	}
	if strings.Contains(lowerCol, "product") || strings.Contains(lowerTable, "product") {
		return "商品数"
	}
	if strings.Contains(lowerCol, "sku") || strings.Contains(lowerTable, "sku") {
		return "SKU数"
	}
	if strings.Contains(lowerCol, "category") || strings.Contains(lowerTable, "category") {
		return "分类数"
	}

	return colName + "计数"
}

// 辅助函数：根据表名推断 COUNT 指标的展示名
func inferTableCountDisplayName(tableName string) string {
	lowerName := strings.ToLower(tableName)

	nameMap := map[string]string{
		"order":         "订单数",
		"orders":        "订单数",
		"transaction":   "交易数",
		"transactions":  "交易数",
		"payment":       "支付数",
		"payments":      "支付数",
		"sale":          "销售数",
		"sales":         "销售数",
		"invoice":       "开票数",
		"invoices":      "开票数",
		"refund":        "退款数",
		"refunds":       "退款数",
		"return":        "退货数",
		"returns":       "退货数",
		"subscription":  "订阅数",
		"subscriptions": "订阅数",
	}

	// 精确匹配
	for pattern, name := range nameMap {
		if strings.Contains(lowerName, pattern) {
			return name
		}
	}

	// 截取表名前缀
	// orders -> order, products -> product
	singular := lowerName
	if strings.HasSuffix(singular, "s") && len(singular) > 1 {
		singular = singular[:len(singular)-1]
	}
	if name, ok := nameMap[singular]; ok {
		return name
	}

	return tableName + "总数"
}

// 辅助函数：在列列表中找主键字段
func findPrimaryKeyColumn(columns []interface{}) string {
	for _, col := range columns {
		colInfo, ok := col.(map[string]interface{})
		if !ok {
			continue
		}

		colName, ok := colInfo["field"].(string)
		if !ok {
			continue
		}

		// 优先找明确的主键标记
		isPK, _ := colInfo["primaryKey"].(bool)
		if isPK {
			return colName
		}

		// 其次找名为 id 或 xxx_id 的字段
		lowerName := strings.ToLower(colName)
		if lowerName == "id" || lowerName == "uuid" || lowerName == "guid" {
			return colName
		}
	}

	return ""
}

// generateID 生成 ID（简单实现，生产环境应该用 UUID）
func generateID(prefix string) string {
	return fmt.Sprintf("%s_%s", prefix, uuid.NewString())
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("data source not found: %w", err)
		}
		return nil, fmt.Errorf("failed to load data source: %w", err)
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("data source not found: %w", err)
		}
		return nil, fmt.Errorf("failed to load data source: %w", err)
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
