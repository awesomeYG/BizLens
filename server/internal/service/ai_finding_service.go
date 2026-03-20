package service

import (
	"ai-bi-server/internal/model"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// AIFindingService AI 发现服务
type AIFindingService struct {
	db                *gorm.DB
	dataSourceService *DataSourceService
}

// NewAIFindingService 创建 AI 发现服务
func NewAIFindingService(db *gorm.DB, dataSourceService *DataSourceService) *AIFindingService {
	return &AIFindingService{
		db:                db,
		dataSourceService: dataSourceService,
	}
}

// AutoDiscover 自动发现数据洞察（连接数据源后调用）
func (s *AIFindingService) AutoDiscover(tenantID, dataSourceID string) error {
	// 获取数据源
	ds, err := s.dataSourceService.GetDataSource(dataSourceID, tenantID)
	if err != nil {
		return fmt.Errorf("获取数据源失败：%w", err)
	}

	// 解析 schema
	if ds.SchemaInfo == "" {
		return fmt.Errorf("数据源暂无 schema 信息")
	}

	schema, err := model.DeserializeSchemaInfo(ds.SchemaInfo)
	if err != nil {
		return fmt.Errorf("解析 schema 失败：%w", err)
	}

	// 获取表列表
	tablesRaw, ok := schema["tables"].([]interface{})
	if !ok {
		return fmt.Errorf("schema 格式错误")
	}

	// 对每个表进行分析
	for _, tableRaw := range tablesRaw {
		tableName, ok := tableRaw.(string)
		if !ok {
			continue
		}

		// 分析表数据
		findings, err := s.analyzeTable(ds, tableName, schema)
		if err != nil {
			continue
		}

		// 保存发现
		for _, finding := range findings {
			finding.TenantID = tenantID
			finding.DataSourceID = dataSourceID
			if err := s.db.Create(&finding).Error; err != nil {
				continue
			}
		}
	}

	return nil
}

// analyzeTable 分析单个表
func (s *AIFindingService) analyzeTable(ds *model.DataSource, tableName string, schema map[string]interface{}) ([]model.AIFinding, error) {
	findings := make([]model.AIFinding, 0)

	// 获取表结构
	structure, ok := schema["structure"].(map[string]interface{})
	if !ok {
		return findings, nil
	}

	columnsRaw, ok := structure[tableName].([]interface{})
	if !ok {
		return findings, nil
	}

	// 分析数值列
	for _, colRaw := range columnsRaw {
		col, ok := colRaw.(map[string]interface{})
		if !ok {
			continue
		}

		fieldName, _ := col["field"].(string)
		dataType, _ := col["type"].(string)

		// 检测数值类型
		if s.isNumericType(dataType) {
			numericalFindings, err := s.analyzeNumericColumn(ds, tableName, fieldName)
			if err == nil {
				findings = append(findings, numericalFindings...)
			}
		}

		// 检测时间类型
		if s.isTimeType(dataType) {
			timeFindings, err := s.analyzeTimeColumn(ds, tableName, fieldName)
			if err == nil {
				findings = append(findings, timeFindings...)
			}
		}

		// 检测分类列（低基数）
		if s.isCategoricalType(dataType) {
			catFindings, err := s.analyzeCategoricalColumn(ds, tableName, fieldName)
			if err == nil {
				findings = append(findings, catFindings...)
			}
		}
	}

	// 检测数据质量问题
	qualityFindings, err := s.detectDataQualityIssues(ds, tableName)
	if err == nil {
		findings = append(findings, qualityFindings...)
	}

	return findings, nil
}

// analyzeNumericColumn 分析数值列
func (s *AIFindingService) analyzeNumericColumn(ds *model.DataSource, tableName, columnName string) ([]model.AIFinding, error) {
	findings := make([]model.AIFinding, 0)

	// 获取样本数据
	query := fmt.Sprintf(`SELECT "%s" FROM "%s" WHERE "%s" IS NOT NULL LIMIT 1000`, columnName, tableName, columnName)
	results, err := s.dataSourceService.ExecuteQuery(ds, query)
	if err != nil {
		return findings, err
	}

	if len(results) == 0 {
		return findings, nil
	}

	// 计算统计信息
	values := make([]float64, 0)
	for _, row := range results {
		if val, ok := row[columnName]; ok {
			switch v := val.(type) {
			case float64:
				values = append(values, v)
			case int64:
				values = append(values, float64(v))
			case int:
				values = append(values, float64(v))
			}
		}
	}

	if len(values) == 0 {
		return findings, nil
	}

	// 计算统计量
	mean, stdDev, min, max := s.calculateStats(values)

	// 发现 1: 数据范围异常
	if max > mean*10 && max > 0 {
		evidence, _ := json.Marshal(map[string]interface{}{
			"max":   max,
			"mean":  mean,
			"ratio": max / mean,
		})
		findings = append(findings, model.AIFinding{
			Type:        model.AIFindingAnomaly,
			Severity:    model.AIFindingSeverityMedium,
			Title:       fmt.Sprintf("%s.%s 存在极端大值", tableName, columnName),
			Description: fmt.Sprintf("该列最大值为 %.2f，是平均值 %.2f 的 %.1f 倍，可能存在数据异常或特殊业务场景", max, mean, max/mean),
			TableName:   tableName,
			ColumnName:  columnName,
			MetricValue: max,
			Evidence:    string(evidence),
			Suggestion:  "建议检查是否存在数据录入错误，或确认该极端值是否有合理的业务解释",
		})
	}

	// 发现 2: 零值比例过高
	zeroCount := 0
	for _, v := range values {
		if v == 0 {
			zeroCount++
		}
	}
	zeroRatio := float64(zeroCount) / float64(len(values))
	if zeroRatio > 0.5 {
		evidence, _ := json.Marshal(map[string]interface{}{
			"zero_count": zeroCount,
			"total":      len(values),
			"ratio":      zeroRatio,
		})
		findings = append(findings, model.AIFinding{
			Type:        model.AIFindingPattern,
			Severity:    model.AIFindingSeverityLow,
			Title:       fmt.Sprintf("%s.%s 零值比例较高", tableName, columnName),
			Description: fmt.Sprintf("该列 %.1f%% 的值为零，可能需要关注数据的有效性", zeroRatio*100),
			TableName:   tableName,
			ColumnName:  columnName,
			MetricValue: zeroRatio * 100,
			Evidence:    string(evidence),
			Suggestion:  "确认零值是否代表缺失数据或特殊业务含义，考虑是否需要单独分析非零数据",
		})
	}

	// 发现 3: 标准差过大（数据波动剧烈）
	if stdDev > mean && mean > 0 {
		cv := stdDev / mean // 变异系数
		if cv > 1.5 {
			evidence, _ := json.Marshal(map[string]interface{}{
				"std_dev": stdDev,
				"mean":    mean,
				"cv":      cv,
				"min":     min,
				"max":     max,
			})
			findings = append(findings, model.AIFinding{
				Type:        model.AIFindingPattern,
				Severity:    model.AIFindingSeverityMedium,
				Title:       fmt.Sprintf("%s.%s 数据波动较大", tableName, columnName),
				Description: fmt.Sprintf("该列变异系数为 %.2f（标准差/均值），表明数据分布较为离散", cv),
				TableName:   tableName,
				ColumnName:  columnName,
				MetricValue: cv,
				Evidence:    string(evidence),
				Suggestion:  "高变异系数可能表明数据存在明显的分组或周期性变化，建议进一步分析数据分布",
			})
		}
	}

	// 发现 4: 负值检测
	negativeCount := 0
	for _, v := range values {
		if v < 0 {
			negativeCount++
		}
	}
	if negativeCount > 0 && negativeCount < len(values) {
		negativeRatio := float64(negativeCount) / float64(len(values))
		evidence, _ := json.Marshal(map[string]interface{}{
			"negative_count": negativeCount,
			"ratio":          negativeRatio,
			"min":            min,
		})
		findings = append(findings, model.AIFinding{
			Type:        model.AIFindingInsight,
			Severity:    model.AIFindingSeverityInfo,
			Title:       fmt.Sprintf("%s.%s 存在负值", tableName, columnName),
			Description: fmt.Sprintf("该列 %.1f%% 的值为负数，最小值为 %.2f", negativeRatio*100, min),
			TableName:   tableName,
			ColumnName:  columnName,
			MetricValue: negativeRatio * 100,
			Evidence:    string(evidence),
			Suggestion:  "确认负值的业务含义（如退款、亏损等），在分析时可能需要分别处理正负值",
		})
	}

	return findings, nil
}

// analyzeTimeColumn 分析时间列
func (s *AIFindingService) analyzeTimeColumn(ds *model.DataSource, tableName, columnName string) ([]model.AIFinding, error) {
	findings := make([]model.AIFinding, 0)

	// 获取时间范围
	query := fmt.Sprintf(`SELECT MIN("%s") as min_time, MAX("%s") as max_time FROM "%s"`, columnName, columnName, tableName)
	results, err := s.dataSourceService.ExecuteQuery(ds, query)
	if err != nil || len(results) == 0 {
		return findings, err
	}

	return findings, nil
}

// analyzeCategoricalColumn 分析分类列
func (s *AIFindingService) analyzeCategoricalColumn(ds *model.DataSource, tableName, columnName string) ([]model.AIFinding, error) {
	findings := make([]model.AIFinding, 0)

	// 获取唯一值数量
	query := fmt.Sprintf(`SELECT COUNT(DISTINCT "%s") as distinct_count, COUNT(*) as total FROM "%s"`, columnName, columnName, tableName)
	results, err := s.dataSourceService.ExecuteQuery(ds, query)
	if err != nil || len(results) == 0 {
		return findings, err
	}

	distinctCount, ok := results[0]["distinct_count"].(float64)
	if !ok {
		return findings, nil
	}

	totalCount, ok := results[0]["total"].(float64)
	if !ok {
		return findings, nil
	}

	// 发现：低基数分类列（适合做维度）
	if distinctCount > 0 && distinctCount < 20 && distinctCount/totalCount < 0.1 {
		evidence, _ := json.Marshal(map[string]interface{}{
			"distinct_count": int64(distinctCount),
			"total_count":    int64(totalCount),
			"ratio":          distinctCount / totalCount,
		})
		findings = append(findings, model.AIFinding{
			Type:        model.AIFindingRecommend,
			Severity:    model.AIFindingSeverityInfo,
			Title:       fmt.Sprintf("%s.%s 适合作为分析维度", tableName, columnName),
			Description: fmt.Sprintf("该列有 %.0f 个唯一值，占总记录的 %.1f%%，适合作为分组维度进行分析", distinctCount, distinctCount/totalCount*100),
			TableName:   tableName,
			ColumnName:  columnName,
			MetricValue: distinctCount,
			Evidence:    string(evidence),
			Suggestion:  "建议在语义模型中将该列定义为维度，可用于数据分组和筛选",
		})
	}

	return findings, nil
}

// detectDataQualityIssues 检测数据质量问题
func (s *AIFindingService) detectDataQualityIssues(ds *model.DataSource, tableName string) ([]model.AIFinding, error) {
	findings := make([]model.AIFinding, 0)

	// 获取表结构
	query := fmt.Sprintf(`SELECT * FROM "%s" LIMIT 1`, tableName)
	results, err := s.dataSourceService.ExecuteQuery(ds, query)
	if err != nil || len(results) == 0 {
		return findings, err
	}

	// 获取列名
	columns := make([]string, 0)
	for col := range results[0] {
		columns = append(columns, col)
	}

	// 检查每列的空值比例
	for _, col := range columns {
		nullQuery := fmt.Sprintf(`SELECT COUNT(*) as total, COUNT("%s") as non_null FROM "%s"`, col, tableName)
		nullResults, err := s.dataSourceService.ExecuteQuery(ds, nullQuery)
		if err != nil || len(nullResults) == 0 {
			continue
		}

		total, ok1 := nullResults[0]["total"].(float64)
		nonNull, ok2 := nullResults[0]["non_null"].(float64)
		if !ok1 || !ok2 || total == 0 {
			continue
		}

		nullRatio := (total - nonNull) / total
		if nullRatio > 0.3 {
			evidence, _ := json.Marshal(map[string]interface{}{
				"null_count":  int64(total - nonNull),
				"total_count": int64(total),
				"ratio":       nullRatio,
			})
			findings = append(findings, model.AIFinding{
				Type:        model.AIFindingAnomaly,
				Severity:    model.AIFindingSeverityHigh,
				Title:       fmt.Sprintf("%s.%s 空值比例较高", tableName, col),
				Description: fmt.Sprintf("该列空值比例为 %.1f%%，可能影响数据分析的准确性", nullRatio*100),
				TableName:   tableName,
				ColumnName:  col,
				MetricValue: nullRatio * 100,
				Evidence:    string(evidence),
				Suggestion:  "建议检查数据源是否存在数据缺失问题，或考虑在分析时进行适当的空值处理",
			})
		}
	}

	return findings, nil
}

// 辅助函数
func (s *AIFindingService) isNumericType(dataType string) bool {
	numericTypes := []string{"int", "integer", "bigint", "smallint", "tinyint", "float", "double", "decimal", "numeric", "real"}
	dataTypeLower := strings.ToLower(dataType)
	for _, t := range numericTypes {
		if strings.Contains(dataTypeLower, t) {
			return true
		}
	}
	return false
}

func (s *AIFindingService) isTimeType(dataType string) bool {
	timeTypes := []string{"date", "time", "timestamp", "datetime"}
	dataTypeLower := strings.ToLower(dataType)
	for _, t := range timeTypes {
		if strings.Contains(dataTypeLower, t) {
			return true
		}
	}
	return false
}

func (s *AIFindingService) isCategoricalType(dataType string) bool {
	catTypes := []string{"varchar", "char", "text", "string", "enum"}
	dataTypeLower := strings.ToLower(dataType)
	for _, t := range catTypes {
		if strings.Contains(dataTypeLower, t) {
			return true
		}
	}
	return false
}

func (s *AIFindingService) calculateStats(values []float64) (mean, stdDev, min, max float64) {
	if len(values) == 0 {
		return 0, 0, 0, 0
	}

	// 计算均值
	sum := 0.0
	min = values[0]
	max = values[0]
	for _, v := range values {
		sum += v
		if v < min {
			min = v
		}
		if v > max {
			max = v
		}
	}
	mean = sum / float64(len(values))

	// 计算标准差
	sumSquares := 0.0
	for _, v := range values {
		diff := v - mean
		sumSquares += diff * diff
	}
	stdDev = math.Sqrt(sumSquares / float64(len(values)))

	return mean, stdDev, min, max
}

// ListFindings 获取 AI 发现列表
func (s *AIFindingService) ListFindings(tenantID, dataSourceID string, findingType model.AIFindingType) ([]model.AIFinding, error) {
	var findings []model.AIFinding
	query := s.db.Where("tenant_id = ? AND data_source_id = ? AND deleted_at IS NULL", tenantID, dataSourceID)

	if findingType != "" {
		query = query.Where("type = ?", findingType)
	}

	err := query.Order("severity DESC, created_at DESC").Find(&findings).Error
	return findings, err
}

// GetFinding 获取单个发现
func (s *AIFindingService) GetFinding(id, tenantID string) (*model.AIFinding, error) {
	var finding model.AIFinding
	err := s.db.Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&finding).Error
	if err != nil {
		return nil, err
	}
	return &finding, nil
}

// DeleteFinding 删除发现
func (s *AIFindingService) DeleteFinding(id, tenantID string) error {
	return s.db.Where("id = ? AND tenant_id = ?", id, tenantID).
		Delete(&model.AIFinding{}).Error
}

// ClearFindings 清空数据源的所有发现
func (s *AIFindingService) ClearFindings(tenantID, dataSourceID string) error {
	return s.db.Where("tenant_id = ? AND data_source_id = ?", tenantID, dataSourceID).
		Delete(&model.AIFinding{}).Error
}

// GetFindingStats 获取发现统计
func (s *AIFindingService) GetFindingStats(tenantID, dataSourceID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 按类型统计
	var typeStats []struct {
		Type  string `json:"type"`
		Count int64  `json:"count"`
	}
	err := s.db.Table("ai_findings").
		Select("type, COUNT(*) as count").
		Where("tenant_id = ? AND data_source_id = ? AND deleted_at IS NULL", tenantID, dataSourceID).
		Group("type").
		Scan(&typeStats).Error
	if err != nil {
		return nil, err
	}
	stats["byType"] = typeStats

	// 按严重程度统计
	var severityStats []struct {
		Severity string `json:"severity"`
		Count    int64  `json:"count"`
	}
	err = s.db.Table("ai_findings").
		Select("severity, COUNT(*) as count").
		Where("tenant_id = ? AND data_source_id = ? AND deleted_at IS NULL", tenantID, dataSourceID).
		Group("severity").
		Scan(&severityStats).Error
	if err != nil {
		return nil, err
	}
	stats["bySeverity"] = severityStats

	// 总数
	var total int64
	err = s.db.Table("ai_findings").
		Where("tenant_id = ? AND data_source_id = ? AND deleted_at IS NULL", tenantID, dataSourceID).
		Count(&total).Error
	if err != nil {
		return nil, err
	}
	stats["total"] = total

	return stats, nil
}

// GetInsightSummary 获取洞察摘要（用于对话上下文）
func (s *AIFindingService) GetInsightSummary(tenantID, dataSourceID string) (string, error) {
	findings, err := s.ListFindings(tenantID, dataSourceID, "")
	if err != nil {
		return "", err
	}

	if len(findings) == 0 {
		return "暂无自动发现的数据洞察", nil
	}

	// 按严重程度排序
	sort.Slice(findings, func(i, j int) bool {
		severityOrder := map[model.AIFindingSeverity]int{
			model.AIFindingSeverityHigh:   0,
			model.AIFindingSeverityMedium: 1,
			model.AIFindingSeverityLow:    2,
			model.AIFindingSeverityInfo:   3,
		}
		return severityOrder[findings[i].Severity] < severityOrder[findings[j].Severity]
	})

	// 取前 5 个重要发现
	summary := "自动数据洞察摘要：\n\n"
	maxCount := 5
	if len(findings) < maxCount {
		maxCount = len(findings)
	}

	for i := 0; i < maxCount; i++ {
		f := findings[i]
		severityText := map[model.AIFindingSeverity]string{
			model.AIFindingSeverityHigh:   "🔴 高",
			model.AIFindingSeverityMedium: "🟡 中",
			model.AIFindingSeverityLow:    "🟢 低",
			model.AIFindingSeverityInfo:   "🔵 提示",
		}
		summary += fmt.Sprintf("%d. [%s] %s\n   %s\n\n", i+1, severityText[f.Severity], f.Title, f.Description)
	}

	if len(findings) > 5 {
		summary += fmt.Sprintf("... 还有 %d 个发现，请查看详情", len(findings)-5)
	}

	return summary, nil
}

// TriggerReDiscovery 手动触发重新发现
func (s *AIFindingService) TriggerReDiscovery(tenantID, dataSourceID string) error {
	// 先清空旧数据
	if err := s.ClearFindings(tenantID, dataSourceID); err != nil {
		return err
	}

	// 重新发现
	return s.AutoDiscover(tenantID, dataSourceID)
}
