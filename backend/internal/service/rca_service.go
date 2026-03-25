package service

import (
	"ai-bi-server/internal/model"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"gorm.io/gorm"
)

// RCAService 根因分析引擎服务
type RCAService struct {
	db                *gorm.DB
	dataSourceService *DataSourceService
	metricService     *MetricService
}

// NewRCAService 创建根因分析服务
func NewRCAService(db *gorm.DB, dataSourceService *DataSourceService, metricService *MetricService) *RCAService {
	return &RCAService{
		db:                db,
		dataSourceService: dataSourceService,
		metricService:     metricService,
	}
}

// RCARequest 根因分析请求
type RCARequest struct {
	TenantID  string `json:"tenantId"`
	MetricID  string `json:"metricId"`  // 要分析的指标 ID
	AnomalyID string `json:"anomalyId"` // 可选：关联的异常事件 ID
	TimeRange string `json:"timeRange"` // today / 7d / 30d
	MaxDepth  int    `json:"maxDepth"`  // 最大下钻层数，默认 3
}

// RCAResult 根因分析结果
type RCAResult struct {
	MetricID     string              `json:"metricId"`
	MetricName   string              `json:"metricName"`
	Summary      string              `json:"summary"` // 自然语言总结
	CurrentValue float64             `json:"currentValue"`
	BaseValue    float64             `json:"baseValue"`    // 对比基准值
	ChangeRate   float64             `json:"changeRate"`   // 变化率（百分比）
	Direction    string              `json:"direction"`    // up / down
	DrillDowns   []DrillDownResult   `json:"drillDowns"`   // 维度下钻结果
	Comparisons  []ComparisonResult  `json:"comparisons"`  // 同比/环比对比
	Correlations []CorrelationResult `json:"correlations"` // 关联指标分析
	Suggestions  []string            `json:"suggestions"`  // 建议操作
	AnalyzedAt   time.Time           `json:"analyzedAt"`
}

// DrillDownResult 维度下钻结果
type DrillDownResult struct {
	DimensionName  string          `json:"dimensionName"`  // 维度名称（如"地区"、"渠道"）
	DimensionField string          `json:"dimensionField"` // 维度字段名
	TotalImpact    float64         `json:"totalImpact"`    // 该维度对总变化的解释度（0-1）
	Items          []DrillDownItem `json:"items"`          // 具体维度值的贡献
}

// DrillDownItem 下钻维度值
type DrillDownItem struct {
	Value        string  `json:"value"`        // 维度值（如"华东"）
	CurrentValue float64 `json:"currentValue"` // 当前值
	BaseValue    float64 `json:"baseValue"`    // 基准值
	Change       float64 `json:"change"`       // 变化量
	ChangeRate   float64 `json:"changeRate"`   // 变化率
	Contribution float64 `json:"contribution"` // 对总体变化的贡献度（百分比）
	IsAnomaly    bool    `json:"isAnomaly"`    // 是否异常
}

// ComparisonResult 同比/环比对比结果
type ComparisonResult struct {
	Type         string  `json:"type"`  // yoy（同比）/ mom（环比）/ wow（周环比）
	Label        string  `json:"label"` // 展示标签
	CurrentValue float64 `json:"currentValue"`
	CompareValue float64 `json:"compareValue"`
	Change       float64 `json:"change"`
	ChangeRate   float64 `json:"changeRate"`
}

// CorrelationResult 关联分析结果
type CorrelationResult struct {
	MetricID    string  `json:"metricId"`
	MetricName  string  `json:"metricName"`
	Correlation float64 `json:"correlation"` // 相关系数 (-1 到 1)
	Direction   string  `json:"direction"`   // positive / negative
	Impact      string  `json:"impact"`      // high / medium / low
	Description string  `json:"description"` // 自然语言描述
}

// Analyze 执行根因分析
func (s *RCAService) Analyze(req RCARequest) (*RCAResult, error) {
	if req.MaxDepth <= 0 {
		req.MaxDepth = 3
	}
	if req.TimeRange == "" {
		req.TimeRange = "7d"
	}

	// 1. 获取指标定义
	metric, err := s.metricService.GetMetric(req.MetricID)
	if err != nil {
		return nil, fmt.Errorf("获取指标失败: %w", err)
	}

	// 2. 获取关联的数据源（通过 BaseTable 查找）
	var dataSource *model.DataSource
	if metric.BaseTable != "" {
		dataSources, _ := s.dataSourceService.ListDataSources(req.TenantID)
		for _, ds := range dataSources {
			if ds.Status == "connected" {
				dataSource = &ds
				break
			}
		}
	}
	if dataSource == nil {
		// fallback: 尝试获取租户的第一个已连接数据源
		dataSources, _ := s.dataSourceService.ListDataSources(req.TenantID)
		for _, ds := range dataSources {
			if ds.Status == "connected" {
				dataSource = &ds
				break
			}
		}
	}

	// 3. 计算时间范围
	now := time.Now()
	currentStart, currentEnd, baseStart, baseEnd := s.calculateTimeRange(now, req.TimeRange)

	// 4. 查询当前值和基准值
	var currentValue, baseValue float64
	if dataSource != nil {
		currentValue, _ = s.queryMetricValue(dataSource, metric, currentStart, currentEnd)
		baseValue, _ = s.queryMetricValue(dataSource, metric, baseStart, baseEnd)
	} else {
		// 尝试从基线获取
		currentValue, baseValue = s.getValuesFromBaseline(req.TenantID, req.MetricID)
	}

	// 5. 计算变化率
	changeRate := 0.0
	direction := "stable"
	if baseValue != 0 {
		changeRate = ((currentValue - baseValue) / math.Abs(baseValue)) * 100
		if changeRate > 1 {
			direction = "up"
		} else if changeRate < -1 {
			direction = "down"
		}
	}

	result := &RCAResult{
		MetricID:     metric.ID,
		MetricName:   metric.DisplayName,
		CurrentValue: currentValue,
		BaseValue:    baseValue,
		ChangeRate:   math.Round(changeRate*100) / 100,
		Direction:    direction,
		DrillDowns:   []DrillDownResult{},
		Comparisons:  []ComparisonResult{},
		Correlations: []CorrelationResult{},
		Suggestions:  []string{},
		AnalyzedAt:   now,
	}

	// 6. 维度下钻分析
	if dataSource != nil {
		drillDowns := s.performDrillDown(dataSource, metric, currentStart, currentEnd, baseStart, baseEnd, req.MaxDepth)
		result.DrillDowns = drillDowns
	}

	// 7. 同比/环比分析
	comparisons := s.performComparisons(dataSource, metric, now)
	result.Comparisons = comparisons

	// 8. 关联指标分析
	correlations := s.performCorrelationAnalysis(req.TenantID, metric, dataSource, currentStart, currentEnd)
	result.Correlations = correlations

	// 9. 生成自然语言总结和建议
	result.Summary = s.generateSummary(result)
	result.Suggestions = s.generateSuggestions(result)

	// 10. 如果关联了异常事件，更新 RootCause 字段
	if req.AnomalyID != "" {
		s.updateAnomalyRootCause(req.AnomalyID, result)
	}

	return result, nil
}

// calculateTimeRange 根据 timeRange 字符串计算时间区间
func (s *RCAService) calculateTimeRange(now time.Time, timeRange string) (currentStart, currentEnd, baseStart, baseEnd time.Time) {
	currentEnd = now
	switch timeRange {
	case "today":
		currentStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		baseStart = currentStart.Add(-24 * time.Hour)
		baseEnd = currentStart
	case "7d":
		currentStart = now.Add(-7 * 24 * time.Hour)
		baseStart = currentStart.Add(-7 * 24 * time.Hour)
		baseEnd = currentStart
	case "30d":
		currentStart = now.Add(-30 * 24 * time.Hour)
		baseStart = currentStart.Add(-30 * 24 * time.Hour)
		baseEnd = currentStart
	default:
		currentStart = now.Add(-7 * 24 * time.Hour)
		baseStart = currentStart.Add(-7 * 24 * time.Hour)
		baseEnd = currentStart
	}
	return
}

// queryMetricValue 从数据源查询指标值
func (s *RCAService) queryMetricValue(dataSource *model.DataSource, metric *model.Metric, start, end time.Time) (float64, error) {
	if metric.BaseTable == "" || metric.BaseField == "" {
		return 0, fmt.Errorf("指标未关联数据表")
	}

	// 查找时间字段
	timeField := s.findTimeField(dataSource, metric.BaseTable)
	if timeField == "" {
		// 无时间字段，查询全表聚合值
		return s.queryAggregateValue(dataSource, metric)
	}

	aggFunc := strings.ToUpper(string(metric.Aggregation))
	if aggFunc == "" {
		aggFunc = "SUM"
	}
	if aggFunc == "COUNT" {
		aggFunc = "COUNT(*)"
	} else {
		aggFunc = fmt.Sprintf("%s(%s)", aggFunc, quoteIdent(dataSource.Type, metric.BaseField))
	}

	query := fmt.Sprintf("SELECT %s FROM %s WHERE %s >= '%s' AND %s < '%s'",
		aggFunc,
		quoteIdent(dataSource.Type, metric.BaseTable),
		quoteIdent(dataSource.Type, timeField),
		start.Format("2006-01-02 15:04:05"),
		quoteIdent(dataSource.Type, timeField),
		end.Format("2006-01-02 15:04:05"),
	)

	rows, err := s.dataSourceService.ExecuteQuery(dataSource, query)
	if err != nil {
		return 0, err
	}
	return extractSingleValue(rows), nil
}

// queryAggregateValue 无时间字段时查询全表聚合
func (s *RCAService) queryAggregateValue(dataSource *model.DataSource, metric *model.Metric) (float64, error) {
	aggFunc := strings.ToUpper(string(metric.Aggregation))
	if aggFunc == "" {
		aggFunc = "SUM"
	}
	var col string
	if aggFunc == "COUNT" {
		col = "COUNT(*)"
	} else {
		col = fmt.Sprintf("%s(%s)", aggFunc, quoteIdent(dataSource.Type, metric.BaseField))
	}

	query := fmt.Sprintf("SELECT %s FROM %s", col, quoteIdent(dataSource.Type, metric.BaseTable))
	rows, err := s.dataSourceService.ExecuteQuery(dataSource, query)
	if err != nil {
		return 0, err
	}
	return extractSingleValue(rows), nil
}

// getValuesFromBaseline 从基线数据获取当前值和基准值
func (s *RCAService) getValuesFromBaseline(tenantID, metricID string) (float64, float64) {
	var baselines []model.MetricBaseline
	s.db.Where("tenant_id = ? AND metric_id = ?", tenantID, metricID).
		Order("computed_at DESC").Limit(2).Find(&baselines)

	if len(baselines) >= 2 {
		return baselines[0].ExpectedValue, baselines[1].ExpectedValue
	}
	if len(baselines) == 1 {
		return baselines[0].ExpectedValue, baselines[0].ExpectedValue * 0.95
	}
	return 0, 0
}

// performDrillDown 执行维度下钻分析
func (s *RCAService) performDrillDown(dataSource *model.DataSource, metric *model.Metric, currentStart, currentEnd, baseStart, baseEnd time.Time, maxDepth int) []DrillDownResult {
	results := []DrillDownResult{}

	// 1. 获取租户的维度定义
	var dimensions []model.Dimension
	s.db.Where("tenant_id = ? AND status = ?", metric.TenantID, "active").
		Order("created_at ASC").Limit(maxDepth).Find(&dimensions)

	// 2. 如果没有预定义维度，尝试自动发现维度字段
	if len(dimensions) == 0 {
		dimensions = s.autoDiscoverDimensions(dataSource, metric.BaseTable)
	}

	timeField := s.findTimeField(dataSource, metric.BaseTable)
	totalChange := 0.0 // 用于计算总变化量

	for _, dim := range dimensions {
		if dim.BaseField == "" {
			continue
		}

		drillResult := DrillDownResult{
			DimensionName:  dim.DisplayName,
			DimensionField: dim.BaseField,
			Items:          []DrillDownItem{},
		}

		// 查询当前期各维度值的聚合
		currentItems := s.queryDimensionBreakdown(dataSource, metric, dim.BaseField, timeField, currentStart, currentEnd)
		// 查询基准期各维度值的聚合
		baseItems := s.queryDimensionBreakdown(dataSource, metric, dim.BaseField, timeField, baseStart, baseEnd)

		// 合并对比
		baseMap := make(map[string]float64)
		for k, v := range baseItems {
			baseMap[k] = v
		}

		items := []DrillDownItem{}
		for dimValue, curVal := range currentItems {
			baseVal := baseMap[dimValue]
			change := curVal - baseVal
			changeRate := 0.0
			if baseVal != 0 {
				changeRate = (change / math.Abs(baseVal)) * 100
			}
			totalChange += math.Abs(change)

			items = append(items, DrillDownItem{
				Value:        dimValue,
				CurrentValue: math.Round(curVal*100) / 100,
				BaseValue:    math.Round(baseVal*100) / 100,
				Change:       math.Round(change*100) / 100,
				ChangeRate:   math.Round(changeRate*100) / 100,
				IsAnomaly:    math.Abs(changeRate) > 20, // > 20% 标记为异常
			})
		}

		// 按绝对变化量排序
		sort.Slice(items, func(i, j int) bool {
			return math.Abs(items[i].Change) > math.Abs(items[j].Change)
		})

		// 计算贡献度
		if totalChange > 0 {
			for i := range items {
				items[i].Contribution = math.Round((math.Abs(items[i].Change)/totalChange)*10000) / 100
			}
		}

		// 只保留 top 10
		if len(items) > 10 {
			items = items[:10]
		}

		drillResult.Items = items

		// 计算该维度对总变化的解释度
		dimImpact := 0.0
		for _, item := range items {
			if item.IsAnomaly {
				dimImpact += item.Contribution / 100
			}
		}
		drillResult.TotalImpact = math.Min(dimImpact, 1.0)

		results = append(results, drillResult)
	}

	return results
}

// queryDimensionBreakdown 按维度分组查询聚合值
func (s *RCAService) queryDimensionBreakdown(dataSource *model.DataSource, metric *model.Metric, dimField, timeField string, start, end time.Time) map[string]float64 {
	result := make(map[string]float64)

	aggFunc := strings.ToUpper(string(metric.Aggregation))
	if aggFunc == "" {
		aggFunc = "SUM"
	}
	var col string
	if aggFunc == "COUNT" {
		col = "COUNT(*)"
	} else {
		col = fmt.Sprintf("%s(%s)", aggFunc, quoteIdent(dataSource.Type, metric.BaseField))
	}

	var query string
	if timeField != "" {
		query = fmt.Sprintf("SELECT %s, %s FROM %s WHERE %s >= '%s' AND %s < '%s' GROUP BY %s ORDER BY %s DESC LIMIT 20",
			quoteIdent(dataSource.Type, dimField),
			col,
			quoteIdent(dataSource.Type, metric.BaseTable),
			quoteIdent(dataSource.Type, timeField),
			start.Format("2006-01-02 15:04:05"),
			quoteIdent(dataSource.Type, timeField),
			end.Format("2006-01-02 15:04:05"),
			quoteIdent(dataSource.Type, dimField),
			col,
		)
	} else {
		query = fmt.Sprintf("SELECT %s, %s FROM %s GROUP BY %s ORDER BY %s DESC LIMIT 20",
			quoteIdent(dataSource.Type, dimField),
			col,
			quoteIdent(dataSource.Type, metric.BaseTable),
			quoteIdent(dataSource.Type, dimField),
			col,
		)
	}

	rows, err := s.dataSourceService.ExecuteQuery(dataSource, query)
	if err != nil {
		log.Printf("维度下钻查询失败: %v", err)
		return result
	}

	for _, row := range rows {
		var dimValue string
		var aggValue float64
		for k, v := range row {
			if strings.EqualFold(k, dimField) {
				dimValue = fmt.Sprintf("%v", v)
			} else {
				aggValue = rcaToFloat64(v)
			}
		}
		if dimValue != "" {
			result[dimValue] = aggValue
		}
	}

	return result
}

// performComparisons 执行同比/环比分析
func (s *RCAService) performComparisons(dataSource *model.DataSource, metric *model.Metric, now time.Time) []ComparisonResult {
	results := []ComparisonResult{}

	// 环比（本周 vs 上周）
	momCurrent := s.queryMetricForPeriod(dataSource, metric, now.Add(-7*24*time.Hour), now)
	momBase := s.queryMetricForPeriod(dataSource, metric, now.Add(-14*24*time.Hour), now.Add(-7*24*time.Hour))
	if momBase != 0 {
		momChangeRate := ((momCurrent - momBase) / math.Abs(momBase)) * 100
		results = append(results, ComparisonResult{
			Type:         "wow",
			Label:        "周环比",
			CurrentValue: math.Round(momCurrent*100) / 100,
			CompareValue: math.Round(momBase*100) / 100,
			Change:       math.Round((momCurrent-momBase)*100) / 100,
			ChangeRate:   math.Round(momChangeRate*100) / 100,
		})
	}

	// 月环比（近30天 vs 前30天）
	monthCurrent := s.queryMetricForPeriod(dataSource, metric, now.Add(-30*24*time.Hour), now)
	monthBase := s.queryMetricForPeriod(dataSource, metric, now.Add(-60*24*time.Hour), now.Add(-30*24*time.Hour))
	if monthBase != 0 {
		monthChangeRate := ((monthCurrent - monthBase) / math.Abs(monthBase)) * 100
		results = append(results, ComparisonResult{
			Type:         "mom",
			Label:        "月环比",
			CurrentValue: math.Round(monthCurrent*100) / 100,
			CompareValue: math.Round(monthBase*100) / 100,
			Change:       math.Round((monthCurrent-monthBase)*100) / 100,
			ChangeRate:   math.Round(monthChangeRate*100) / 100,
		})
	}

	// 同比（本月 vs 去年同月）
	yoyCurrent := s.queryMetricForPeriod(dataSource, metric, now.Add(-30*24*time.Hour), now)
	yoyBase := s.queryMetricForPeriod(dataSource, metric, now.Add(-395*24*time.Hour), now.Add(-365*24*time.Hour))
	if yoyBase != 0 {
		yoyChangeRate := ((yoyCurrent - yoyBase) / math.Abs(yoyBase)) * 100
		results = append(results, ComparisonResult{
			Type:         "yoy",
			Label:        "同比",
			CurrentValue: math.Round(yoyCurrent*100) / 100,
			CompareValue: math.Round(yoyBase*100) / 100,
			Change:       math.Round((yoyCurrent-yoyBase)*100) / 100,
			ChangeRate:   math.Round(yoyChangeRate*100) / 100,
		})
	}

	return results
}

// queryMetricForPeriod 查询指定时间段的指标值
func (s *RCAService) queryMetricForPeriod(dataSource *model.DataSource, metric *model.Metric, start, end time.Time) float64 {
	if dataSource == nil || metric.BaseTable == "" {
		return 0
	}
	val, _ := s.queryMetricValue(dataSource, metric, start, end)
	return val
}

// performCorrelationAnalysis 执行关联指标分析
func (s *RCAService) performCorrelationAnalysis(tenantID string, targetMetric *model.Metric, dataSource *model.DataSource, start, end time.Time) []CorrelationResult {
	results := []CorrelationResult{}

	// 获取同租户的其他已确认指标
	var otherMetrics []model.Metric
	s.db.Where("tenant_id = ? AND id != ? AND status = ?", tenantID, targetMetric.ID, "confirmed").
		Limit(10).Find(&otherMetrics)

	if dataSource == nil || len(otherMetrics) == 0 {
		return results
	}

	// 获取目标指标的时间序列
	targetSeries := s.queryTimeSeries(dataSource, targetMetric, start, end)
	if len(targetSeries) < 3 {
		return results
	}

	for _, other := range otherMetrics {
		if other.BaseTable == "" || other.BaseField == "" {
			continue
		}

		otherSeries := s.queryTimeSeries(dataSource, &other, start, end)
		if len(otherSeries) < 3 {
			continue
		}

		// 计算皮尔逊相关系数
		corr := pearsonCorrelation(targetSeries, otherSeries)
		if math.IsNaN(corr) {
			continue
		}

		absCorr := math.Abs(corr)
		if absCorr < 0.3 {
			continue // 忽略弱相关
		}

		direction := "positive"
		if corr < 0 {
			direction = "negative"
		}

		impact := "low"
		if absCorr > 0.7 {
			impact = "high"
		} else if absCorr > 0.5 {
			impact = "medium"
		}

		desc := fmt.Sprintf("%s 与 %s %s相关（r=%.2f）",
			other.DisplayName, targetMetric.DisplayName,
			map[string]string{"positive": "正", "negative": "负"}[direction],
			corr,
		)

		results = append(results, CorrelationResult{
			MetricID:    other.ID,
			MetricName:  other.DisplayName,
			Correlation: math.Round(corr*1000) / 1000,
			Direction:   direction,
			Impact:      impact,
			Description: desc,
		})
	}

	// 按相关性绝对值排序
	sort.Slice(results, func(i, j int) bool {
		return math.Abs(results[i].Correlation) > math.Abs(results[j].Correlation)
	})

	if len(results) > 5 {
		results = results[:5]
	}

	return results
}

// queryTimeSeries 查询指标的时间序列
func (s *RCAService) queryTimeSeries(dataSource *model.DataSource, metric *model.Metric, start, end time.Time) []float64 {
	timeField := s.findTimeField(dataSource, metric.BaseTable)
	if timeField == "" {
		return nil
	}

	aggFunc := strings.ToUpper(string(metric.Aggregation))
	if aggFunc == "" {
		aggFunc = "SUM"
	}
	var col string
	if aggFunc == "COUNT" {
		col = "COUNT(*)"
	} else {
		col = fmt.Sprintf("%s(%s)", aggFunc, quoteIdent(dataSource.Type, metric.BaseField))
	}

	var dateTrunc string
	switch model.DataSourceType(dataSource.Type) {
	case model.DataSourceMySQL:
		dateTrunc = fmt.Sprintf("DATE(%s)", quoteIdent(dataSource.Type, timeField))
	case model.DataSourcePostgreSQL:
		dateTrunc = fmt.Sprintf("DATE(%s)", quoteIdent(dataSource.Type, timeField))
	default:
		dateTrunc = fmt.Sprintf("DATE(%s)", quoteIdent(dataSource.Type, timeField))
	}

	query := fmt.Sprintf("SELECT %s AS d, %s AS v FROM %s WHERE %s >= '%s' AND %s < '%s' GROUP BY d ORDER BY d",
		dateTrunc,
		col,
		quoteIdent(dataSource.Type, metric.BaseTable),
		quoteIdent(dataSource.Type, timeField),
		start.Format("2006-01-02 15:04:05"),
		quoteIdent(dataSource.Type, timeField),
		end.Format("2006-01-02 15:04:05"),
	)

	rows, err := s.dataSourceService.ExecuteQuery(dataSource, query)
	if err != nil {
		return nil
	}

	values := make([]float64, 0, len(rows))
	for _, row := range rows {
		if v, ok := row["v"]; ok {
			values = append(values, rcaToFloat64(v))
		}
	}
	return values
}

// autoDiscoverDimensions 自动发现可下钻的维度字段
func (s *RCAService) autoDiscoverDimensions(dataSource *model.DataSource, tableName string) []model.Dimension {
	dims := []model.Dimension{}
	if dataSource == nil || tableName == "" {
		return dims
	}

	schema, err := s.dataSourceService.FetchSchema(dataSource)
	if err != nil {
		return dims
	}

	structure, ok := schema["structure"].(map[string]interface{})
	if !ok {
		return dims
	}

	columns, ok := structure[tableName]
	if !ok {
		return dims
	}

	colList, ok := columns.([]map[string]interface{})
	if !ok {
		// 尝试 interface{} 切片
		rawList, ok2 := columns.([]interface{})
		if !ok2 {
			return dims
		}
		for _, raw := range rawList {
			colMap, ok3 := raw.(map[string]interface{})
			if !ok3 {
				continue
			}
			colList = append(colList, colMap)
		}
	}

	// 典型维度字段模式
	dimPatterns := []string{"category", "type", "status", "region", "channel", "source", "brand", "department", "city", "province", "country", "platform", "tier", "level", "group"}

	for _, col := range colList {
		fieldName, _ := col["field"].(string)
		fieldType, _ := col["type"].(string)

		if !isTextType(fieldType) {
			continue
		}

		// 跳过 ID 和 name 字段
		lower := strings.ToLower(fieldName)
		if strings.HasSuffix(lower, "_id") || strings.HasSuffix(lower, "id") ||
			lower == "name" || lower == "email" || lower == "phone" ||
			lower == "address" || lower == "description" || lower == "note" {
			continue
		}

		// 匹配维度模式
		isDim := false
		for _, pattern := range dimPatterns {
			if strings.Contains(lower, pattern) {
				isDim = true
				break
			}
		}

		if isDim {
			dims = append(dims, model.Dimension{
				DisplayName: fieldName,
				BaseField:   fieldName,
				BaseTable:   tableName,
			})
		}
	}

	// 最多返回 3 个维度
	if len(dims) > 3 {
		dims = dims[:3]
	}

	return dims
}

// findTimeField 查找表中的时间字段
func (s *RCAService) findTimeField(dataSource *model.DataSource, tableName string) string {
	if dataSource == nil || tableName == "" {
		return ""
	}

	schema, err := s.dataSourceService.FetchSchema(dataSource)
	if err != nil {
		return ""
	}

	structure, ok := schema["structure"].(map[string]interface{})
	if !ok {
		return ""
	}

	columns, ok := structure[tableName]
	if !ok {
		return ""
	}

	// 优先匹配常见时间字段名
	timePatterns := []string{"created_at", "create_time", "order_time", "order_date", "date", "time", "timestamp", "updated_at", "created"}

	var colList []map[string]interface{}
	switch v := columns.(type) {
	case []map[string]interface{}:
		colList = v
	case []interface{}:
		for _, raw := range v {
			if colMap, ok := raw.(map[string]interface{}); ok {
				colList = append(colList, colMap)
			}
		}
	}

	// 先按模式匹配
	for _, pattern := range timePatterns {
		for _, col := range colList {
			fieldName, _ := col["field"].(string)
			if strings.EqualFold(fieldName, pattern) {
				return fieldName
			}
		}
	}

	// 再按类型匹配
	for _, col := range colList {
		fieldName, _ := col["field"].(string)
		fieldType, _ := col["type"].(string)
		if isTimeType(fieldType) {
			return fieldName
		}
		// 含 time/date 关键字
		lower := strings.ToLower(fieldName)
		if strings.Contains(lower, "time") || strings.Contains(lower, "date") {
			return fieldName
		}
	}

	return ""
}

// generateSummary 生成自然语言总结
func (s *RCAService) generateSummary(result *RCAResult) string {
	parts := []string{}

	// 总体概述
	directionText := map[string]string{"up": "上升", "down": "下降", "stable": "持平"}[result.Direction]
	parts = append(parts, fmt.Sprintf("指标「%s」当前值 %.2f，相比基准期 %s %.2f%%。",
		result.MetricName, result.CurrentValue, directionText, math.Abs(result.ChangeRate)))

	// 主要贡献维度
	for _, drill := range result.DrillDowns {
		anomalyItems := []string{}
		for _, item := range drill.Items {
			if item.IsAnomaly {
				anomalyItems = append(anomalyItems, fmt.Sprintf("%s（%.1f%%）", item.Value, item.ChangeRate))
			}
		}
		if len(anomalyItems) > 0 {
			parts = append(parts, fmt.Sprintf("按%s拆解，主要波动来自：%s。",
				drill.DimensionName, strings.Join(anomalyItems, "、")))
		}
	}

	// 同比/环比信息
	for _, comp := range result.Comparisons {
		if math.Abs(comp.ChangeRate) > 5 {
			dir := "增长"
			if comp.ChangeRate < 0 {
				dir = "下降"
			}
			parts = append(parts, fmt.Sprintf("%s %s %.1f%%。", comp.Label, dir, math.Abs(comp.ChangeRate)))
		}
	}

	// 关联指标
	for _, corr := range result.Correlations {
		if corr.Impact == "high" {
			parts = append(parts, corr.Description+"。")
		}
	}

	return strings.Join(parts, "")
}

// generateSuggestions 生成操作建议
func (s *RCAService) generateSuggestions(result *RCAResult) []string {
	suggestions := []string{}

	if result.Direction == "down" && math.Abs(result.ChangeRate) > 10 {
		suggestions = append(suggestions, fmt.Sprintf("「%s」显著下降，建议重点关注", result.MetricName))
	}

	// 根据维度下钻结果给建议
	for _, drill := range result.DrillDowns {
		for _, item := range drill.Items {
			if item.IsAnomaly && math.Abs(item.ChangeRate) > 30 {
				action := "增长"
				if item.ChangeRate < 0 {
					action = "下滑"
				}
				suggestions = append(suggestions, fmt.Sprintf("「%s=%s」%s %.1f%%，建议深入分析原因",
					drill.DimensionName, item.Value, action, math.Abs(item.ChangeRate)))
			}
		}
	}

	// 根据同比环比给建议
	for _, comp := range result.Comparisons {
		if comp.ChangeRate < -20 {
			suggestions = append(suggestions, fmt.Sprintf("%s下降 %.1f%%，可能存在季节性或结构性问题", comp.Label, math.Abs(comp.ChangeRate)))
		}
	}

	if len(suggestions) == 0 {
		suggestions = append(suggestions, "当前指标波动在正常范围内，建议持续观察")
	}

	return suggestions
}

// updateAnomalyRootCause 更新异常事件的根因分析结果
func (s *RCAService) updateAnomalyRootCause(anomalyID string, result *RCAResult) {
	rootCauseJSON, _ := json.Marshal(result)
	s.db.Model(&model.AnomalyEvent{}).Where("id = ?", anomalyID).
		Update("root_cause", string(rootCauseJSON))
}

// --- 辅助函数 ---

// quoteIdent 根据数据库类型引用标识符
func quoteIdent(dbType model.DataSourceType, identifier string) string {
	switch dbType {
	case model.DataSourceMySQL:
		return "`" + identifier + "`"
	case model.DataSourcePostgreSQL:
		return `"` + identifier + `"`
	default:
		return `"` + identifier + `"`
	}
}

// rcaToFloat64 将接口值转为 float64
func rcaToFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case float32:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case int32:
		return float64(val)
	case string:
		f := 0.0
		fmt.Sscanf(val, "%f", &f)
		return f
	case json.Number:
		f, _ := val.Float64()
		return f
	case *sql.NullFloat64:
		if val != nil && val.Valid {
			return val.Float64
		}
		return 0
	default:
		return 0
	}
}

// extractSingleValue 从查询结果中提取单一数值
func extractSingleValue(rows []map[string]interface{}) float64 {
	if len(rows) == 0 {
		return 0
	}
	for _, v := range rows[0] {
		return rcaToFloat64(v)
	}
	return 0
}

// pearsonCorrelation 计算皮尔逊相关系数
func pearsonCorrelation(x, y []float64) float64 {
	n := len(x)
	if len(y) < n {
		n = len(y)
	}
	if n < 3 {
		return 0
	}

	// 截断到相同长度
	x = x[:n]
	y = y[:n]

	meanX := 0.0
	meanY := 0.0
	for i := 0; i < n; i++ {
		meanX += x[i]
		meanY += y[i]
	}
	meanX /= float64(n)
	meanY /= float64(n)

	cov := 0.0
	varX := 0.0
	varY := 0.0
	for i := 0; i < n; i++ {
		dx := x[i] - meanX
		dy := y[i] - meanY
		cov += dx * dy
		varX += dx * dx
		varY += dy * dy
	}

	denom := math.Sqrt(varX * varY)
	if denom == 0 {
		return 0
	}
	return cov / denom
}
