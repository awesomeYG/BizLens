package service

import (
	"ai-bi-server/internal/model"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

// BaselineService 基线学习服务
type BaselineService struct {
	db                *gorm.DB
	dataSourceService *DataSourceService
	metricService     *MetricService
}

// NewBaselineService 创建基线服务
func NewBaselineService(db *gorm.DB) *BaselineService {
	return &BaselineService{db: db}
}

// SetDataDependencies 设置数据依赖（延迟注入避免循环引用）
func (s *BaselineService) SetDataDependencies(dsSvc *DataSourceService, metricSvc *MetricService) {
	s.dataSourceService = dsSvc
	s.metricService = metricSvc
}

// LearnBaseline 学习指标基线（从真实数据源查询历史数据）
func (s *BaselineService) LearnBaseline(tenantID, metricID string, granularity string, windowDays int) error {
	// 1. 获取历史数据值
	values := s.fetchHistoricalValues(tenantID, metricID, windowDays)

	if len(values) == 0 {
		return fmt.Errorf("无历史数据")
	}

	// 2. 计算期望值和标准差
	expected := mean(values)
	stdDev := standardDeviation(values, expected)

	// 3. 保存基线
	now := time.Now()
	periodKey := s.getPeriodKey(now, granularity)

	baseline := &model.MetricBaseline{
		TenantID:      tenantID,
		MetricID:      metricID,
		Granularity:   granularity,
		PeriodKey:     periodKey,
		ExpectedValue: expected,
		StdDev:        stdDev,
		UpperBound:    expected + 2*stdDev,
		LowerBound:    expected - 2*stdDev,
		SampleCount:   len(values),
		Method:        "moving_avg",
		ComputedAt:    now,
	}

	return s.db.Create(baseline).Error
}

// GetBaseline 获取指标基线
func (s *BaselineService) GetBaseline(tenantID, metricID, granularity string) (*model.MetricBaseline, error) {
	var baseline model.MetricBaseline
	now := time.Now()
	periodKey := s.getPeriodKey(now, granularity)

	err := s.db.Where("tenant_id = ? AND metric_id = ? AND granularity = ? AND period_key = ?",
		tenantID, metricID, granularity, periodKey).
		Order("computed_at DESC").
		First(&baseline).Error

	if err != nil {
		return nil, err
	}
	return &baseline, nil
}

// QueryCurrentValue 从真实数据源查询指标的当前值
func (s *BaselineService) QueryCurrentValue(tenantID, metricID string) (float64, error) {
	if s.metricService == nil || s.dataSourceService == nil {
		return 0, fmt.Errorf("数据依赖未初始化")
	}

	// 获取指标定义
	metric, err := s.metricService.GetMetric(metricID)
	if err != nil {
		return 0, fmt.Errorf("获取指标失败: %w", err)
	}

	if metric.BaseTable == "" || metric.BaseField == "" {
		return 0, fmt.Errorf("指标未关联数据表")
	}

	// 获取可用数据源
	ds := s.findActiveDataSource(tenantID)
	if ds == nil {
		return 0, fmt.Errorf("无可用数据源")
	}

	// 查询今日聚合值
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	timeField := s.findTimeFieldForTable(ds, metric.BaseTable)

	aggFunc := fmt.Sprintf("SUM(%s)", quoteIdent(ds.Type, metric.BaseField))
	if metric.Aggregation == model.AggCount {
		aggFunc = "COUNT(*)"
	} else if metric.Aggregation == model.AggAvg {
		aggFunc = fmt.Sprintf("AVG(%s)", quoteIdent(ds.Type, metric.BaseField))
	}

	var query string
	if timeField != "" {
		query = fmt.Sprintf("SELECT %s FROM %s WHERE %s >= '%s'",
			aggFunc,
			quoteIdent(ds.Type, metric.BaseTable),
			quoteIdent(ds.Type, timeField),
			todayStart.Format("2006-01-02 15:04:05"),
		)
	} else {
		query = fmt.Sprintf("SELECT %s FROM %s", aggFunc, quoteIdent(ds.Type, metric.BaseTable))
	}

	rows, err := s.dataSourceService.ExecuteQuery(ds, query)
	if err != nil {
		return 0, err
	}

	return extractSingleValue(rows), nil
}

// fetchHistoricalValues 从真实数据源获取历史数据值
func (s *BaselineService) fetchHistoricalValues(tenantID, metricID string, windowDays int) []float64 {
	// 尝试从真实数据源查询
	if s.metricService != nil && s.dataSourceService != nil {
		values := s.fetchFromRealDataSource(tenantID, metricID, windowDays)
		if len(values) > 0 {
			return values
		}
	}

	// fallback: 从已有基线记录推算
	var baselines []model.MetricBaseline
	s.db.Where("tenant_id = ? AND metric_id = ?", tenantID, metricID).
		Order("computed_at DESC").Limit(windowDays).Find(&baselines)

	if len(baselines) > 0 {
		values := make([]float64, len(baselines))
		for i, b := range baselines {
			values[i] = b.ExpectedValue
		}
		return values
	}

	return nil
}

// fetchFromRealDataSource 从真实数据源查询每日数据
func (s *BaselineService) fetchFromRealDataSource(tenantID, metricID string, windowDays int) []float64 {
	metric, err := s.metricService.GetMetric(metricID)
	if err != nil || metric.BaseTable == "" || metric.BaseField == "" {
		return nil
	}

	ds := s.findActiveDataSource(tenantID)
	if ds == nil {
		return nil
	}

	timeField := s.findTimeFieldForTable(ds, metric.BaseTable)
	if timeField == "" {
		return nil
	}

	now := time.Now()
	start := now.Add(-time.Duration(windowDays) * 24 * time.Hour)

	aggFunc := fmt.Sprintf("SUM(%s)", quoteIdent(ds.Type, metric.BaseField))
	if metric.Aggregation == model.AggCount {
		aggFunc = "COUNT(*)"
	} else if metric.Aggregation == model.AggAvg {
		aggFunc = fmt.Sprintf("AVG(%s)", quoteIdent(ds.Type, metric.BaseField))
	}

	dateTrunc := fmt.Sprintf("DATE(%s)", quoteIdent(ds.Type, timeField))

	query := fmt.Sprintf("SELECT %s AS d, %s AS v FROM %s WHERE %s >= '%s' AND %s < '%s' GROUP BY d ORDER BY d",
		dateTrunc,
		aggFunc,
		quoteIdent(ds.Type, metric.BaseTable),
		quoteIdent(ds.Type, timeField),
		start.Format("2006-01-02 15:04:05"),
		quoteIdent(ds.Type, timeField),
		now.Format("2006-01-02 15:04:05"),
	)

	rows, err := s.dataSourceService.ExecuteQuery(ds, query)
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

// findActiveDataSource 查找租户的已连接数据源
func (s *BaselineService) findActiveDataSource(tenantID string) *model.DataSource {
	if s.dataSourceService == nil {
		return nil
	}
	dataSources, _ := s.dataSourceService.ListDataSources(tenantID)
	for _, ds := range dataSources {
		if ds.Status == "connected" {
			dsCopy := ds
			return &dsCopy
		}
	}
	return nil
}

// findTimeFieldForTable 查找表的时间字段
func (s *BaselineService) findTimeFieldForTable(ds *model.DataSource, tableName string) string {
	if s.dataSourceService == nil {
		return ""
	}

	schema, err := s.dataSourceService.FetchSchema(ds)
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

	var colList []map[string]interface{}
	switch v := columns.(type) {
	case []map[string]interface{}:
		colList = v
	case []interface{}:
		for _, raw := range v {
			if colMap, ok2 := raw.(map[string]interface{}); ok2 {
				colList = append(colList, colMap)
			}
		}
	}

	timePatterns := []string{"created_at", "create_time", "order_time", "order_date", "date", "timestamp"}
	for _, pattern := range timePatterns {
		for _, col := range colList {
			fieldName, _ := col["field"].(string)
			if fieldName == pattern {
				return fieldName
			}
		}
	}

	for _, col := range colList {
		fieldName, _ := col["field"].(string)
		fieldType, _ := col["type"].(string)
		if isTimeType(fieldType) {
			return fieldName
		}
	}

	return ""
}

// 辅助函数
func (s *BaselineService) getPeriodKey(t time.Time, granularity string) string {
	switch granularity {
	case "hourly":
		return t.Format("2006-01-02T15")
	case "daily":
		return t.Format("2006-01-02")
	case "weekly":
		year, week := t.ISOWeek()
		return fmt.Sprintf("%d-W%02d", year, week)
	default:
		return t.Format("2006-01-02")
	}
}

// 统计函数
func mean(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func standardDeviation(values []float64, mean float64) float64 {
	variance := 0.0
	for _, v := range values {
		variance += math.Pow(v-mean, 2)
	}
	return math.Sqrt(variance / float64(len(values)))
}
