package service

import (
	"ai-bi-server/internal/model"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

// DailySummaryService 每日摘要服务
type DailySummaryService struct {
	db                *gorm.DB
	anomalyService    *AnomalyService
	imService         *IMService
	dataSourceService *DataSourceService
	metricService     *MetricService
}

// NewDailySummaryService 创建每日摘要服务
func NewDailySummaryService(db *gorm.DB, anomalyService *AnomalyService, imService *IMService) *DailySummaryService {
	return &DailySummaryService{
		db:             db,
		anomalyService: anomalyService,
		imService:      imService,
	}
}

// SetDataDependencies 设置数据依赖（避免循环依赖，延迟注入）
func (s *DailySummaryService) SetDataDependencies(dsSvc *DataSourceService, metricSvc *MetricService) {
	s.dataSourceService = dsSvc
	s.metricService = metricSvc
}

// SummaryContent 摘要内容结构（增强版）
type SummaryContent struct {
	HealthScore int                `json:"healthScore"`
	Metrics     []MetricSummary    `json:"metrics"`
	Anomalies   []AnomalySummary   `json:"anomalies"`
	Trends      []string           `json:"trends"`
	Predictions []MetricPrediction `json:"predictions,omitempty"` // 趋势预测
	TopChanges  []MetricSummary    `json:"topChanges,omitempty"`  // 变化最大的指标
}

// MetricSummary 指标摘要
type MetricSummary struct {
	Name         string  `json:"name"`
	DisplayName  string  `json:"displayName,omitempty"`
	MetricID     string  `json:"metricId,omitempty"`
	CurrentValue float64 `json:"currentValue"`
	PrevValue    float64 `json:"prevValue,omitempty"`
	Change       float64 `json:"change"`    // 百分比
	Direction    string  `json:"direction"` // up/down/stable
	Unit         string  `json:"unit,omitempty"`
}

// AnomalySummary 异常摘要
type AnomalySummary struct {
	MetricID   string  `json:"metricId"`
	MetricName string  `json:"metricName,omitempty"`
	Severity   string  `json:"severity"`
	Change     float64 `json:"change"`
}

// MetricPrediction 指标趋势预测
type MetricPrediction struct {
	MetricID      string    `json:"metricId"`
	MetricName    string    `json:"metricName"`
	CurrentValue  float64   `json:"currentValue"`
	PredictedNext float64   `json:"predictedNext"` // 下一周期预测值
	Trend         string    `json:"trend"`         // rising / falling / stable
	Confidence    float64   `json:"confidence"`    // 预测置信度（0-1）
	HistoryValues []float64 `json:"historyValues"` // 历史数据点
	Description   string    `json:"description"`   // 自然语言描述
}

// GenerateDailySummary 生成每日摘要（增强版：接入真实数据源）
func (s *DailySummaryService) GenerateDailySummary(tenantID string) (*model.DailySummary, error) {
	today := time.Now().Format("2006-01-02")

	// 1. 获取今日异常
	anomalies, _ := s.anomalyService.ListAnomalies(tenantID, model.AnomalyOpen, 20)

	// 2. 查询核心指标数据（从真实数据源）
	metricSummaries := s.queryRealMetricSummaries(tenantID)

	// 3. 计算健康评分
	healthScore := s.calculateHealthScore(anomalies, metricSummaries)

	// 4. 生成趋势预测
	predictions := s.generatePredictions(tenantID)

	// 5. 提取变化最大的指标（Top Changes）
	topChanges := s.extractTopChanges(metricSummaries, 5)

	// 6. 生成趋势描述
	trends := s.generateTrendDescriptions(metricSummaries, predictions, anomalies)

	// 7. 构建异常摘要
	anomalySummaries := make([]AnomalySummary, 0)
	for _, a := range anomalies {
		change := 0.0
		if a.ExpectedValue != 0 {
			change = ((a.ActualValue - a.ExpectedValue) / a.ExpectedValue) * 100
		}
		anomalySummaries = append(anomalySummaries, AnomalySummary{
			MetricID:   a.MetricID,
			MetricName: a.MetricID, // 简化：使用 ID 作为名称
			Severity:   string(a.Severity),
			Change:     math.Round(change*10) / 10,
		})
	}

	// 8. 构建完整摘要内容
	content := SummaryContent{
		HealthScore: healthScore,
		Metrics:     metricSummaries,
		Anomalies:   anomalySummaries,
		Trends:      trends,
		Predictions: predictions,
		TopChanges:  topChanges,
	}

	contentJSON, _ := json.Marshal(content)

	// 9. 保存摘要
	summary := &model.DailySummary{
		TenantID:    tenantID,
		SummaryDate: today,
		HealthScore: healthScore,
		Content:     string(contentJSON),
	}

	if err := s.db.Create(summary).Error; err != nil {
		return nil, err
	}

	return summary, nil
}

// queryRealMetricSummaries 从真实数据源查询指标摘要
func (s *DailySummaryService) queryRealMetricSummaries(tenantID string) []MetricSummary {
	summaries := []MetricSummary{}

	if s.metricService == nil || s.dataSourceService == nil {
		return summaries
	}

	// 获取租户的已确认指标
	metrics, err := s.metricService.ListMetrics(tenantID, "", "confirmed")
	if err != nil || len(metrics) == 0 {
		// fallback: 也尝试 active 状态
		metrics, _ = s.metricService.ListMetrics(tenantID, "", "active")
	}

	// 获取可用数据源
	dataSources, _ := s.dataSourceService.ListDataSources(tenantID)
	var activeDS *model.DataSource
	for _, ds := range dataSources {
		if ds.Status == "connected" {
			activeDS = &ds
			break
		}
	}

	if activeDS == nil || len(metrics) == 0 {
		return summaries
	}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	yesterdayStart := todayStart.Add(-24 * time.Hour)

	for _, metric := range metrics {
		if metric.BaseTable == "" || metric.BaseField == "" {
			continue
		}

		// 查询今日值
		currentVal := s.queryMetricForRange(activeDS, &metric, todayStart, now)
		// 查询昨日值
		prevVal := s.queryMetricForRange(activeDS, &metric, yesterdayStart, todayStart)

		change := 0.0
		direction := "stable"
		if prevVal != 0 {
			change = ((currentVal - prevVal) / math.Abs(prevVal)) * 100
			if change > 1 {
				direction = "up"
			} else if change < -1 {
				direction = "down"
			}
		}

		unit := ""
		if metric.DataType == model.MetricTypeCurrency {
			unit = "yuan"
		}

		summaries = append(summaries, MetricSummary{
			Name:         metric.Name,
			DisplayName:  metric.DisplayName,
			MetricID:     metric.ID,
			CurrentValue: math.Round(currentVal*100) / 100,
			PrevValue:    math.Round(prevVal*100) / 100,
			Change:       math.Round(change*100) / 100,
			Direction:    direction,
			Unit:         unit,
		})
	}

	return summaries
}

// queryMetricForRange 查询指定时间段的指标值（复用 RCA 中的模式）
func (s *DailySummaryService) queryMetricForRange(ds *model.DataSource, metric *model.Metric, start, end time.Time) float64 {
	if ds == nil || metric.BaseTable == "" || metric.BaseField == "" {
		return 0
	}

	// 检测时间字段
	timeField := s.findTimeField(ds, metric.BaseTable)

	aggFunc := fmt.Sprintf("SUM(%s)", quoteIdent(ds.Type, metric.BaseField))
	if metric.Aggregation == model.AggCount {
		aggFunc = "COUNT(*)"
	} else if metric.Aggregation == model.AggAvg {
		aggFunc = fmt.Sprintf("AVG(%s)", quoteIdent(ds.Type, metric.BaseField))
	} else if metric.Aggregation == model.AggMax {
		aggFunc = fmt.Sprintf("MAX(%s)", quoteIdent(ds.Type, metric.BaseField))
	} else if metric.Aggregation == model.AggMin {
		aggFunc = fmt.Sprintf("MIN(%s)", quoteIdent(ds.Type, metric.BaseField))
	}

	var query string
	if timeField != "" {
		query = fmt.Sprintf("SELECT %s FROM %s WHERE %s >= '%s' AND %s < '%s'",
			aggFunc,
			quoteIdent(ds.Type, metric.BaseTable),
			quoteIdent(ds.Type, timeField),
			start.Format("2006-01-02 15:04:05"),
			quoteIdent(ds.Type, timeField),
			end.Format("2006-01-02 15:04:05"),
		)
	} else {
		// 无时间字段，查全量
		query = fmt.Sprintf("SELECT %s FROM %s", aggFunc, quoteIdent(ds.Type, metric.BaseTable))
	}

	rows, err := s.dataSourceService.ExecuteQuery(ds, query)
	if err != nil {
		return 0
	}
	return extractSingleValue(rows)
}

// findTimeField 查找时间字段（简化版，后续和 RCA 共享）
func (s *DailySummaryService) findTimeField(ds *model.DataSource, tableName string) string {
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

	// 优先名称匹配
	timePatterns := []string{"created_at", "create_time", "order_time", "order_date", "date", "timestamp"}
	for _, pattern := range timePatterns {
		for _, col := range colList {
			fieldName, _ := col["field"].(string)
			if fieldName == pattern {
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
	}

	return ""
}

// generatePredictions 生成趋势预测
func (s *DailySummaryService) generatePredictions(tenantID string) []MetricPrediction {
	predictions := []MetricPrediction{}

	if s.metricService == nil || s.dataSourceService == nil {
		return predictions
	}

	metrics, _ := s.metricService.ListMetrics(tenantID, "", "confirmed")
	if len(metrics) == 0 {
		metrics, _ = s.metricService.ListMetrics(tenantID, "", "active")
	}

	dataSources, _ := s.dataSourceService.ListDataSources(tenantID)
	var activeDS *model.DataSource
	for _, ds := range dataSources {
		if ds.Status == "connected" {
			activeDS = &ds
			break
		}
	}

	if activeDS == nil {
		return predictions
	}

	now := time.Now()

	for _, metric := range metrics {
		if metric.BaseTable == "" || metric.BaseField == "" {
			continue
		}

		// 获取最近 14 天每日值
		historyValues := s.queryDailyValues(activeDS, &metric, now.Add(-14*24*time.Hour), now)
		if len(historyValues) < 3 {
			continue
		}

		// 使用线性回归预测下一天
		predicted, confidence := linearRegressionPredict(historyValues)
		currentValue := historyValues[len(historyValues)-1]

		trend := "stable"
		if len(historyValues) >= 3 {
			recentAvg := (historyValues[len(historyValues)-1] + historyValues[len(historyValues)-2] + historyValues[len(historyValues)-3]) / 3
			olderAvg := historyValues[0]
			if len(historyValues) >= 6 {
				olderAvg = (historyValues[0] + historyValues[1] + historyValues[2]) / 3
			}
			if recentAvg > olderAvg*1.05 {
				trend = "rising"
			} else if recentAvg < olderAvg*0.95 {
				trend = "falling"
			}
		}

		desc := fmt.Sprintf("%s 近期呈%s趋势，预计明日值约 %.0f",
			metric.DisplayName,
			map[string]string{"rising": "上升", "falling": "下降", "stable": "平稳"}[trend],
			predicted,
		)

		predictions = append(predictions, MetricPrediction{
			MetricID:      metric.ID,
			MetricName:    metric.DisplayName,
			CurrentValue:  math.Round(currentValue*100) / 100,
			PredictedNext: math.Round(predicted*100) / 100,
			Trend:         trend,
			Confidence:    math.Round(confidence*1000) / 1000,
			HistoryValues: historyValues,
			Description:   desc,
		})
	}

	return predictions
}

// queryDailyValues 查询每日指标值序列
func (s *DailySummaryService) queryDailyValues(ds *model.DataSource, metric *model.Metric, start, end time.Time) []float64 {
	timeField := s.findTimeField(ds, metric.BaseTable)
	if timeField == "" {
		return nil
	}

	aggFunc := fmt.Sprintf("SUM(%s)", quoteIdent(ds.Type, metric.BaseField))
	if metric.Aggregation == model.AggCount {
		aggFunc = "COUNT(*)"
	} else if metric.Aggregation == model.AggAvg {
		aggFunc = fmt.Sprintf("AVG(%s)", quoteIdent(ds.Type, metric.BaseField))
	}

	var dateTrunc string
	switch ds.Type {
	case model.DataSourceMySQL:
		dateTrunc = fmt.Sprintf("DATE(%s)", quoteIdent(ds.Type, timeField))
	default:
		dateTrunc = fmt.Sprintf("DATE(%s)", quoteIdent(ds.Type, timeField))
	}

	query := fmt.Sprintf("SELECT %s AS d, %s AS v FROM %s WHERE %s >= '%s' AND %s < '%s' GROUP BY d ORDER BY d",
		dateTrunc,
		aggFunc,
		quoteIdent(ds.Type, metric.BaseTable),
		quoteIdent(ds.Type, timeField),
		start.Format("2006-01-02 15:04:05"),
		quoteIdent(ds.Type, timeField),
		end.Format("2006-01-02 15:04:05"),
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

// calculateHealthScore 计算业务健康评分
func (s *DailySummaryService) calculateHealthScore(anomalies []model.AnomalyEvent, metrics []MetricSummary) int {
	score := 100

	// 异常扣分
	for _, a := range anomalies {
		if a.Severity == model.SeverityCritical {
			score -= 10
		} else if a.Severity == model.SeverityWarning {
			score -= 5
		} else {
			score -= 2
		}
	}

	// 指标大幅下降扣分
	for _, m := range metrics {
		if m.Change < -20 {
			score -= 8
		} else if m.Change < -10 {
			score -= 4
		}
	}

	if score < 0 {
		score = 0
	}
	return score
}

// extractTopChanges 提取变化最大的指标
func (s *DailySummaryService) extractTopChanges(metrics []MetricSummary, limit int) []MetricSummary {
	if len(metrics) == 0 {
		return nil
	}

	// 复制并按绝对变化率排序
	sorted := make([]MetricSummary, len(metrics))
	copy(sorted, metrics)

	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if math.Abs(sorted[j].Change) > math.Abs(sorted[i].Change) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	if len(sorted) > limit {
		sorted = sorted[:limit]
	}
	return sorted
}

// generateTrendDescriptions 生成趋势描述
func (s *DailySummaryService) generateTrendDescriptions(metrics []MetricSummary, predictions []MetricPrediction, anomalies []model.AnomalyEvent) []string {
	trends := []string{}

	// 统计涨跌情况
	upCount := 0
	downCount := 0
	for _, m := range metrics {
		if m.Direction == "up" {
			upCount++
		} else if m.Direction == "down" {
			downCount++
		}
	}

	if len(metrics) > 0 {
		trends = append(trends, fmt.Sprintf("今日共监控 %d 个核心指标，%d 个上升、%d 个下降",
			len(metrics), upCount, downCount))
	}

	if len(anomalies) > 0 {
		critCount := 0
		for _, a := range anomalies {
			if a.Severity == model.SeverityCritical {
				critCount++
			}
		}
		if critCount > 0 {
			trends = append(trends, fmt.Sprintf("发现 %d 个异常，其中 %d 个严重", len(anomalies), critCount))
		} else {
			trends = append(trends, fmt.Sprintf("发现 %d 个轻微异常", len(anomalies)))
		}
	} else {
		trends = append(trends, "今日无异常检测告警")
	}

	// 趋势预测摘要
	risingCount := 0
	fallingCount := 0
	for _, p := range predictions {
		if p.Trend == "rising" {
			risingCount++
		} else if p.Trend == "falling" {
			fallingCount++
		}
	}
	if risingCount > 0 || fallingCount > 0 {
		trends = append(trends, fmt.Sprintf("趋势预测：%d 个指标上行、%d 个指标下行", risingCount, fallingCount))
	}

	return trends
}

// ListSummaries 查询历史摘要
func (s *DailySummaryService) ListSummaries(tenantID string, limit int) ([]model.DailySummary, error) {
	var summaries []model.DailySummary
	err := s.db.Where("tenant_id = ?", tenantID).
		Order("summary_date DESC").
		Limit(limit).
		Find(&summaries).Error
	return summaries, err
}

// GetLatestSummary 获取最新摘要
func (s *DailySummaryService) GetLatestSummary(tenantID string) (*model.DailySummary, error) {
	var summary model.DailySummary
	err := s.db.Where("tenant_id = ?", tenantID).
		Order("summary_date DESC").
		First(&summary).Error
	if err != nil {
		return nil, err
	}
	return &summary, nil
}

// SendDailySummary 发送每日摘要到 IM
func (s *DailySummaryService) SendDailySummary(tenantID string, platformIDs []string) error {
	summary, err := s.GenerateDailySummary(tenantID)
	if err != nil {
		return err
	}

	// 解析内容
	var content SummaryContent
	json.Unmarshal([]byte(summary.Content), &content)

	// 构建增强版消息
	message := fmt.Sprintf(
		"[每日业务摘要]\n\n"+
			"日期: %s\n"+
			"健康评分: %d/100\n\n",
		summary.SummaryDate,
		content.HealthScore,
	)

	// 核心指标速览
	if len(content.Metrics) > 0 {
		message += "-- 核心指标 --\n"
		for _, m := range content.Metrics {
			arrow := "~"
			if m.Direction == "up" {
				arrow = "+"
			} else if m.Direction == "down" {
				arrow = "-"
			}
			name := m.DisplayName
			if name == "" {
				name = m.Name
			}
			message += fmt.Sprintf("  %s: %.0f (%s%.1f%%)\n", name, m.CurrentValue, arrow, math.Abs(m.Change))
		}
		message += "\n"
	}

	// 异常告警
	if len(content.Anomalies) > 0 {
		message += "-- 需要关注 --\n"
		for _, a := range content.Anomalies {
			message += fmt.Sprintf("  [%s] %s: %.1f%% 变化\n", a.Severity, a.MetricID, a.Change)
		}
		message += "\n"
	} else {
		message += "今日无异常，业务运行正常\n\n"
	}

	// 趋势预测
	if len(content.Predictions) > 0 {
		message += "-- 趋势预测 --\n"
		for _, p := range content.Predictions {
			message += fmt.Sprintf("  %s\n", p.Description)
		}
	}

	// 推送
	s.imService.SendNotification(tenantID, platformIDs, "daily_summary", "每日业务摘要", message, true)

	// 更新发送时间
	now := time.Now()
	summary.SentAt = &now
	s.db.Save(summary)

	return nil
}

// --- 预测算法 ---

// linearRegressionPredict 使用线性回归预测下一个值
// 返回：预测值 和 R^2 置信度
func linearRegressionPredict(values []float64) (predicted float64, confidence float64) {
	n := float64(len(values))
	if n < 2 {
		return values[len(values)-1], 0
	}

	// 简单线性回归 y = a + b*x
	sumX := 0.0
	sumY := 0.0
	sumXY := 0.0
	sumX2 := 0.0
	for i, y := range values {
		x := float64(i)
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	denom := n*sumX2 - sumX*sumX
	if denom == 0 {
		return values[len(values)-1], 0
	}

	b := (n*sumXY - sumX*sumY) / denom
	a := (sumY - b*sumX) / n

	// 预测下一个点
	nextX := float64(len(values))
	predicted = a + b*nextX

	// 计算 R^2
	meanY := sumY / n
	ssTot := 0.0
	ssRes := 0.0
	for i, y := range values {
		yPred := a + b*float64(i)
		ssTot += (y - meanY) * (y - meanY)
		ssRes += (y - yPred) * (y - yPred)
	}

	if ssTot > 0 {
		confidence = 1 - ssRes/ssTot
		if confidence < 0 {
			confidence = 0
		}
	}

	// 加权移动平均修正（降低纯线性回归的激进性）
	if len(values) >= 3 {
		wma := values[len(values)-1]*0.5 + values[len(values)-2]*0.3 + values[len(values)-3]*0.2
		predicted = predicted*0.6 + wma*0.4 // 融合线性回归和加权移动平均
	}

	return predicted, confidence
}
