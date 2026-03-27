package service

import (
	"ai-bi-server/internal/model"
	"encoding/json"
	"errors"
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
	rcaService        *RCAService
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

// SetRCADependency 设置 RCA 服务依赖
func (s *DailySummaryService) SetRCADependency(rcaSvc *RCAService) {
	s.rcaService = rcaSvc
}

// SummaryContent 摘要内容结构（增强版 V2：含根因分析和目标达成）
type SummaryContent struct {
	HealthScore   int                `json:"healthScore"`
	Metrics       []MetricSummary    `json:"metrics"`
	Anomalies     []AnomalySummary   `json:"anomalies"`
	Trends        []string           `json:"trends"`
	Predictions   []MetricPrediction `json:"predictions,omitempty"`   // 趋势预测
	TopChanges    []MetricSummary    `json:"topChanges,omitempty"`    // 变化最大的指标
	Concerns      []ConcernItem      `json:"concerns,omitempty"`      // 需要关注的异常（含 AI 分析和建议）
	Positives     []PositiveItem     `json:"positives,omitempty"`     // 正面趋势
	WeeklyTargets []WeeklyTarget     `json:"weeklyTargets,omitempty"` // 每周目标达成率
}

// ConcernItem 需要关注的异常项（含 AI 分析和建议）
type ConcernItem struct {
	MetricID      string   `json:"metricId"`
	MetricName    string   `json:"metricName,omitempty"`
	Severity      string   `json:"severity"` // critical/warning/info
	CurrentValue  float64  `json:"currentValue"`
	BaselineValue float64  `json:"baselineValue,omitempty"`
	Change        float64  `json:"change"`              // 变化百分比
	Analysis      string   `json:"analysis"`            // AI 分析原因
	Suggestions   []string `json:"suggestions"`         // 建议操作
	DrillDown     *string  `json:"drillDown,omitempty"` // 维度下钻结果（可选）
}

// PositiveItem 正面趋势
type PositiveItem struct {
	MetricID     string  `json:"metricId"`
	MetricName   string  `json:"metricName,omitempty"`
	CurrentValue float64 `json:"currentValue"`
	Change       float64 `json:"change"` // 正向变化百分比
	Reason       string  `json:"reason"` // 正面原因描述
}

// WeeklyTarget 每周目标达成率
type WeeklyTarget struct {
	MetricID        string  `json:"metricId"`
	MetricName      string  `json:"metricName"`
	CurrentValue    float64 `json:"currentValue"`    // 本周累计值
	TargetValue     float64 `json:"targetValue"`     // 周目标值（从指标配置中取）
	AchievementRate float64 `json:"achievementRate"` // 达成率百分比
	Trend           string  `json:"trend"`           // on_track/at_risk/ahead/behind
	DaysLeft        int     `json:"daysLeft"`        // 剩余天数
	Description     string  `json:"description"`     // 描述
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

// GenerateDailySummary 生成每日摘要（增强版 V2：含 RCA 根因分析 + 目标达成）
func (s *DailySummaryService) GenerateDailySummary(tenantID string) (*model.DailySummary, error) {
	today := time.Now().Format("2006-01-02")

	// 前置检查：确保已配置数据源和指标
	if s.dataSourceService == nil || s.metricService == nil {
		return nil, fmt.Errorf("data source or metric service not initialized")
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
		return nil, fmt.Errorf("no_active_data_source: 请先在数据源页面配置并连接您的数据库")
	}
	metrics, _ := s.metricService.ListMetrics(tenantID, "", "confirmed")
	if len(metrics) == 0 {
		metrics, _ = s.metricService.ListMetrics(tenantID, "", "active")
	}
	if len(metrics) == 0 {
		return nil, fmt.Errorf("no_metrics: 请先在数据源页面发现并确认要监控的指标")
	}

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

	// 8. [新增] 对每个异常执行 RCA 根因分析，生成 Concerns 列表
	concerns := s.buildConcernItems(tenantID, anomalies)

	// 9. [新增] 从正常或正向指标中提取正面趋势
	positives := s.extractPositiveItems(metricSummaries, anomalies)

	// 10. [新增] 计算每周目标达成率
	weeklyTargets := s.calculateWeeklyTargets(tenantID, metricSummaries)

	// 11. 构建完整摘要内容
	content := SummaryContent{
		HealthScore:   healthScore,
		Metrics:       metricSummaries,
		Anomalies:     anomalySummaries,
		Trends:        trends,
		Predictions:   predictions,
		TopChanges:    topChanges,
		Concerns:      concerns,
		Positives:     positives,
		WeeklyTargets: weeklyTargets,
	}

	contentJSON, _ := json.Marshal(content)

	// 12. 保存摘要
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

// buildConcernItems 为每个异常构建 ConcernItem（含 RCA 根因分析和 AI 建议）
func (s *DailySummaryService) buildConcernItems(tenantID string, anomalies []model.AnomalyEvent) []ConcernItem {
	concerns := []ConcernItem{}

	for _, anomaly := range anomalies {
		// 获取指标名称
		metricName := anomaly.MetricID
		if s.metricService != nil {
			if metric, err := s.metricService.GetMetric(anomaly.MetricID); err == nil && metric.DisplayName != "" {
				metricName = metric.DisplayName
			}
		}

		change := 0.0
		if anomaly.ExpectedValue != 0 {
			change = ((anomaly.ActualValue - anomaly.ExpectedValue) / math.Abs(anomaly.ExpectedValue)) * 100
		}

		item := ConcernItem{
			MetricID:      anomaly.MetricID,
			MetricName:    metricName,
			Severity:      string(anomaly.Severity),
			CurrentValue:  math.Round(anomaly.ActualValue*100) / 100,
			BaselineValue: math.Round(anomaly.ExpectedValue*100) / 100,
			Change:        math.Round(change*10) / 10,
			Suggestions:   []string{},
		}

		// 如果 RCA 服务可用，对关键异常执行根因分析
		if s.rcaService != nil && (anomaly.Severity == model.SeverityCritical || anomaly.Severity == model.SeverityWarning) {
			rcaResult, err := s.rcaService.Analyze(RCARequest{
				TenantID:  tenantID,
				MetricID:  anomaly.MetricID,
				TimeRange: "7d",
				MaxDepth:  2,
			})
			if err == nil && rcaResult != nil {
				item.Analysis = rcaResult.Summary
				item.Suggestions = rcaResult.Suggestions
				// 如果有维度下钻结果，取最关键的
				if len(rcaResult.DrillDowns) > 0 {
					for _, dd := range rcaResult.DrillDowns {
						if len(dd.Items) > 0 {
							// 取贡献度最大的维度项
							maxItem := dd.Items[0]
							for _, it := range dd.Items[1:] {
								if it.Contribution > maxItem.Contribution {
									maxItem = it
								}
							}
							if maxItem.Contribution > 10 {
								drillStr := fmt.Sprintf("%s: %s 变化 %.1f%%（贡献度 %.1f%%）",
									dd.DimensionName, maxItem.Value, maxItem.ChangeRate, maxItem.Contribution)
								item.DrillDown = &drillStr
							}
							break
						}
					}
				}
			}
		}

		// 如果没有 RCA 结果，使用规则化分析
		if item.Analysis == "" {
			changeDir := "下降"
			if anomaly.Direction == "up" {
				changeDir = "上升"
			}
			item.Analysis = fmt.Sprintf("%s 较基线%s %.1f%%，偏离 %.1f 个标准差",
				metricName, changeDir, math.Abs(change), anomaly.Deviation)
		}

		// 如果没有建议，生成规则化建议
		if len(item.Suggestions) == 0 {
			item.Suggestions = s.generateDefaultSuggestions(anomaly, change)
		}

		concerns = append(concerns, item)
	}

	return concerns
}

// generateDefaultSuggestions 根据异常类型生成默认建议
func (s *DailySummaryService) generateDefaultSuggestions(anomaly model.AnomalyEvent, change float64) []string {
	suggestions := []string{}

	if anomaly.Severity == model.SeverityCritical {
		suggestions = append(suggestions, "建议立即关注：该指标偏离基线过大")
	}

	if anomaly.Direction == "down" {
		suggestions = append(suggestions, "建议检查相关业务数据和操作日志")
		suggestions = append(suggestions, "可点击下方「根因分析」获取详细信息")
	} else {
		suggestions = append(suggestions, "当前上升趋势良好，建议持续监控")
	}

	return suggestions
}

// extractPositiveItems 从指标中提取正面趋势
func (s *DailySummaryService) extractPositiveItems(metrics []MetricSummary, anomalies []model.AnomalyEvent) []PositiveItem {
	positives := []PositiveItem{}

	// 创建一个集合，记录异常指标 ID
	anomalyMetricIDs := make(map[string]bool)
	for _, a := range anomalies {
		anomalyMetricIDs[a.MetricID] = true
	}

	// 找出变化率 > 5% 且不是异常的指标
	for _, m := range metrics {
		// 跳过有异常的指标
		if anomalyMetricIDs[m.MetricID] || anomalyMetricIDs[m.Name] {
			continue
		}

		// 只保留正向变化且变化显著的
		if m.Direction == "up" && m.Change > 5 {
			reason := "近期表现良好，环比上升"
			// 根据变化率给出不同描述
			if m.Change > 20 {
				reason = "大幅增长，环比上升"
			} else if m.Change > 10 {
				reason = "稳步增长，环比上升"
			}
			positives = append(positives, PositiveItem{
				MetricID:     m.MetricID,
				MetricName:   m.DisplayName,
				CurrentValue: m.CurrentValue,
				Change:       m.Change,
				Reason:       reason,
			})
		}
	}

	return positives
}

// calculateWeeklyTargets 计算每周目标达成率
func (s *DailySummaryService) calculateWeeklyTargets(tenantID string, metrics []MetricSummary) []WeeklyTarget {
	targets := []WeeklyTarget{}

	if s.metricService == nil || s.dataSourceService == nil {
		return targets
	}

	// 获取已确认/活跃的指标
	confirmedMetrics, _ := s.metricService.ListMetrics(tenantID, "", "confirmed")
	if len(confirmedMetrics) == 0 {
		confirmedMetrics, _ = s.metricService.ListMetrics(tenantID, "", "active")
	}

	// 获取数据源
	dataSources, _ := s.dataSourceService.ListDataSources(tenantID)
	var activeDS *model.DataSource
	for _, ds := range dataSources {
		if ds.Status == "connected" {
			activeDS = &ds
			break
		}
	}

	now := time.Now()

	// 计算本周是第几周，以及本周开始/结束日期
	year := now.Year()
	yearDay := now.YearDay()
	week := yearDay / 7
	if yearDay%7 != 0 {
		week++
	}
	weekStart := getWeekStart(int(year), week)

	// 剩余天数
	daysInWeek := 7
	dayOfWeek := int(now.Weekday())
	if dayOfWeek == 0 {
		dayOfWeek = 7
	}
	daysLeft := daysInWeek - dayOfWeek

	for _, metric := range confirmedMetrics {
		if metric.BaseTable == "" || metric.BaseField == "" {
			continue
		}

		// 查询本周累计值
		var weekTotal float64
		if activeDS != nil {
			weekTotal = s.queryMetricForRange(activeDS, &metric, weekStart, now)
		}

		// 从 metric.Tags 或其他地方尝试获取目标值
		// 目前 MVP 阶段：使用日均值 * 7 作为周目标
		dayAvg := 0.0
		if dayOfWeek > 0 {
			dayAvg = weekTotal / float64(dayOfWeek)
		}
		targetValue := dayAvg * 7

		// 如果本周已有数据，但变化率明显上升/下降，重新估算
		// 计算上周同期总量，用于设定合理目标
		lastWeekStart := weekStart.Add(-7 * 24 * time.Hour)
		lastWeekTotal := 0.0
		if activeDS != nil {
			lastWeekTotal = s.queryMetricForRange(activeDS, &metric, lastWeekStart, weekStart)
		}

		trend := "on_track"
		if targetValue > 0 && dayOfWeek > 0 {
			// 进度评估 = (当前累计 / 目标) / (已过天数 / 7)
			// 如果进度比 > 1.1 说明 ahead，< 0.85 说明 at_risk
			expectedProgress := float64(dayOfWeek) / 7.0
			actualProgress := 0.0
			if targetValue > 0 {
				actualProgress = weekTotal / targetValue
			}
			completionRatio := 0.0
			if expectedProgress > 0 {
				completionRatio = actualProgress / expectedProgress
			}
			if completionRatio >= 1.1 {
				trend = "ahead"
			} else if completionRatio < 0.85 {
				trend = "at_risk"
			}

			// 重新计算目标值：基于上周实际 * 增长目标（默认 5%）
			if lastWeekTotal > 0 {
				targetValue = lastWeekTotal * 1.05
			}
		}

		achievementRate := 0.0
		description := ""
		if targetValue > 0 {
			achievementRate = math.Round((weekTotal/targetValue)*10000) / 100
			if trend == "ahead" {
				description = fmt.Sprintf("本周累计 %.0f，预计本周达成率约 %.0f%%（领先目标）",
					weekTotal, achievementRate)
			} else if trend == "at_risk" {
				description = fmt.Sprintf("本周累计 %.0f，距目标 %.0f 还差约 %.0f，需加快节奏",
					weekTotal, targetValue, targetValue-weekTotal)
			} else {
				description = fmt.Sprintf("本周累计 %.0f，目标 %.0f，当前达成率约 %.0f%%",
					weekTotal, targetValue, achievementRate)
			}
		} else {
			description = fmt.Sprintf("本周累计 %.0f（日均 %.0f）", weekTotal, dayAvg)
		}

		// 只添加有实际数据的指标
		if weekTotal > 0 || lastWeekTotal > 0 {
			targets = append(targets, WeeklyTarget{
				MetricID:        metric.ID,
				MetricName:      metric.DisplayName,
				CurrentValue:    math.Round(weekTotal*100) / 100,
				TargetValue:     math.Round(targetValue*100) / 100,
				AchievementRate: achievementRate,
				Trend:           trend,
				DaysLeft:        daysLeft,
				Description:     description,
			})
		}
	}

	return targets
}

// getWeekStart 获取指定年/周的第一天（周一）
func getWeekStart(year, week int) time.Time {
	// 找到该年 1 月 1 日
	jan1 := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	// 计算第 1 周的周一
	// ISO 8601：1 月 4 日所在的周是第 1 周，周一是该周第一天
	isoWeek := week
	if isoWeek < 1 {
		isoWeek = 1
	}
	// 找到 year 年 1 月 1 日是周几（周一=0）
	dayOfWeek := int(jan1.Weekday()) - 1
	if dayOfWeek < 0 {
		dayOfWeek = 6
	}
	// 第 1 周周一
	week1Monday := jan1.AddDate(0, 0, -dayOfWeek)
	// 第 isoWeek 周周一
	return week1Monday.AddDate(0, 0, (isoWeek-1)*7)
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
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

	// 构建增强版 V2 消息（匹配文档规划格式）
	message := fmt.Sprintf(
		"========== BizLens 每日业务摘要 ==========\n"+
			"日期：%s\n\n"+
			"[健康评分] %d/100\n\n",
		summary.SummaryDate,
		content.HealthScore,
	)

	// 核心指标速览
	if len(content.Metrics) > 0 {
		message += "[核心指标速览]\n"
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
			message += fmt.Sprintf("  %s: %.0f  同比 %s%.1f%%\n", name, m.CurrentValue, arrow, math.Abs(m.Change))
		}
		message += "\n"
	}

	// 需要关注（增强版：含 AI 分析和建议）
	if len(content.Concerns) > 0 {
		message += fmt.Sprintf("[需要关注] %d 项\n", len(content.Concerns))
		for i, c := range content.Concerns {
			message += fmt.Sprintf("  %d. %s 当前 %.0f（基线 %.0f，变化 %.1f%%）\n", i+1, c.MetricName, c.CurrentValue, c.BaselineValue, c.Change)
			if c.Analysis != "" {
				message += fmt.Sprintf("     -> AI 分析：%s\n", c.Analysis)
			}
			for j, sug := range c.Suggestions {
				if j < 2 { // 最多显示2条建议
					message += fmt.Sprintf("     -> 建议：%s\n", sug)
				}
			}
		}
		message += "\n"
	} else if len(content.Anomalies) > 0 {
		message += fmt.Sprintf("[需要关注] %d 项\n", len(content.Anomalies))
		for i, a := range content.Anomalies {
			message += fmt.Sprintf("  %d. %s: %.1f%% 变化\n", i+1, a.MetricName, a.Change)
		}
		message += "\n"
	}

	// 正面趋势
	if len(content.Positives) > 0 {
		message += fmt.Sprintf("[正面趋势] %d 项\n", len(content.Positives))
		for i, p := range content.Positives {
			message += fmt.Sprintf("  %d. %s 升至 %.0f（环比 +%.1f%%）\n", i+1, p.MetricName, p.CurrentValue, p.Change)
			if p.Reason != "" {
				message += fmt.Sprintf("     -> %s\n", p.Reason)
			}
		}
		message += "\n"
	}

	// 每周目标达成
	if len(content.WeeklyTargets) > 0 {
		message += "[本周目标达成]\n"
		for _, t := range content.WeeklyTargets {
			if t.AchievementRate > 0 {
				message += fmt.Sprintf("  %s: %.0f / %.0f（达成率 %.0f%%，%s）\n",
					t.MetricName, t.CurrentValue, t.TargetValue, t.AchievementRate, t.Trend)
			}
		}
		message += "\n"
	}

	// 趋势预测
	if len(content.Predictions) > 0 {
		message += "[趋势预测]\n"
		for _, p := range content.Predictions {
			message += fmt.Sprintf("  %s\n", p.Description)
		}
		message += "\n"
	}

	message += "==========================================\n"

	// 推送
	s.imService.SendNotification(tenantID, platformIDs, "每日业务摘要", message, true)

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
