package service

import (
	"ai-bi-server/internal/model"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

type AnalysisIntent struct {
	Type         string                   `json:"type"`
	Metrics      []string                 `json:"metrics"`
	Dimensions   []string                 `json:"dimensions"`
	Filters      []map[string]interface{} `json:"filters"`
	TimeRange    string                   `json:"timeRange"`
	Granularity  string                   `json:"granularity"`
	CompareMode  string                   `json:"compareMode"`
	MissingSlots []string                 `json:"missingSlots"`
}

type AnalysisPlan struct {
	Objective      string                   `json:"objective"`
	MetricNames    []string                 `json:"metricNames"`
	DimensionNames []string                 `json:"dimensionNames"`
	Filters        []map[string]interface{} `json:"filters"`
	TimeRange      string                   `json:"timeRange"`
	Granularity    string                   `json:"granularity"`
	Steps          []string                 `json:"steps"`
	Assumptions    []string                 `json:"assumptions"`
}

type AnalysisQualityReport struct {
	Checks     []map[string]interface{} `json:"checks"`
	Confidence string                   `json:"confidence"`
	Issues     []string                 `json:"issues"`
}

type AnalysisInsight struct {
	Conclusion          string   `json:"conclusion"`
	Evidence            []string `json:"evidence"`
	Breakdown           []string `json:"breakdown"`
	Suggestions         []string `json:"suggestions"`
	ChartRecommendation string   `json:"chartRecommendation"`
}

type AnalysisPacket struct {
	Intent            AnalysisIntent         `json:"intent"`
	SemanticMapping   map[string]interface{} `json:"semanticMapping"`
	Plan              AnalysisPlan           `json:"plan"`
	SQL               string                 `json:"sql"`
	Quality           AnalysisQualityReport  `json:"quality"`
	Insight           AnalysisInsight        `json:"insight"`
	ClarificationHint string                 `json:"clarificationQuestion,omitempty"`
	Evaluation        map[string]interface{} `json:"evaluation,omitempty"`
}

type AnalysisService struct {
	db *gorm.DB
}

func NewAnalysisService(db *gorm.DB) *AnalysisService {
	return &AnalysisService{db: db}
}

func (s *AnalysisService) AnalyzeQuestion(tenantID, question string) AnalysisPacket {
	intent := parseIntent(question)
	semantic := mapToSemantic(intent, question)
	plan := buildPlan(intent)
	sql := generateSafeSQL(plan)
	quality := runQualityChecks(sql, intent)
	insight := buildInsight(intent, quality)

	packet := AnalysisPacket{
		Intent:          intent,
		SemanticMapping: semantic,
		Plan:            plan,
		SQL:             sql,
		Quality:         quality,
		Insight:         insight,
	}
	packet.ClarificationHint = buildClarification(intent)
	return packet
}

func (s *AnalysisService) RecordQueryLog(tenantID, question string, packet AnalysisPacket, durationMs int64, success bool) error {
	metricsJSON, _ := json.Marshal(packet.Intent.Metrics)
	dimsJSON, _ := json.Marshal(packet.Intent.Dimensions)
	issuesJSON, _ := json.Marshal(packet.Quality.Issues)

	log := model.AnalysisQueryLog{
		ID:               generateAnalysisID("analysis_log"),
		TenantID:         tenantID,
		Question:         question,
		IntentType:       packet.Intent.Type,
		Metrics:          string(metricsJSON),
		Dimensions:       string(dimsJSON),
		TimeRange:        packet.Intent.TimeRange,
		SQLText:          packet.SQL,
		Confidence:       packet.Quality.Confidence,
		HadClarification: packet.ClarificationHint != "",
		Success:          success,
		DurationMs:       durationMs,
		QualityIssues:    string(issuesJSON),
	}
	return s.db.Create(&log).Error
}

func (s *AnalysisService) GetEvaluationSummary(tenantID string) (map[string]interface{}, error) {
	var logs []model.AnalysisQueryLog
	if err := s.db.Where("tenant_id = ?", tenantID).Order("created_at desc").Limit(200).Find(&logs).Error; err != nil {
		return nil, err
	}
	if len(logs) == 0 {
		return map[string]interface{}{
			"totalQueries":           0,
			"querySuccessRate":       0.0,
			"clarificationRate":      0.0,
			"avgResponseMs":          0,
			"confidenceDistribution": map[string]int{"high": 0, "medium": 0, "low": 0},
			"recentTrend":            []map[string]interface{}{},
		}, nil
	}

	var successCount, clarificationCount int
	var totalDuration int64
	conf := map[string]int{"high": 0, "medium": 0, "low": 0}

	for _, l := range logs {
		if l.Success {
			successCount++
		}
		if l.HadClarification {
			clarificationCount++
		}
		totalDuration += l.DurationMs
		if _, ok := conf[l.Confidence]; ok {
			conf[l.Confidence]++
		}
	}
	recentTrend := make([]map[string]interface{}, 0)
	recentSize := len(logs)
	if recentSize > 20 {
		recentSize = 20
	}
	for i := recentSize - 1; i >= 0; i-- {
		item := logs[i]
		recentTrend = append(recentTrend, map[string]interface{}{
			"timestamp":        item.CreatedAt.UnixMilli(),
			"success":          item.Success,
			"hadClarification": item.HadClarification,
			"confidence":       item.Confidence,
			"durationMs":       item.DurationMs,
		})
	}

	total := float64(len(logs))
	return map[string]interface{}{
		"totalQueries":           len(logs),
		"querySuccessRate":       roundFloat(float64(successCount)/total*100, 1),
		"clarificationRate":      roundFloat(float64(clarificationCount)/total*100, 1),
		"avgResponseMs":          totalDuration / int64(len(logs)),
		"confidenceDistribution": conf,
		"recentTrend":            recentTrend,
	}, nil
}

func parseIntent(question string) AnalysisIntent {
	q := strings.ToLower(question)
	metrics := extractSemanticKeys(q, map[string][]string{
		"gmv":             {"gmv", "销售额", "销售金额", "成交额", "营收", "revenue"},
		"order_count":     {"订单", "订单量", "单量"},
		"conversion_rate": {"转化率", "下单转化"},
		"customer_count":  {"客户数", "用户数", "买家数"},
	})
	dimensions := extractSemanticKeys(q, map[string][]string{
		"category":     {"品类", "类别", "分类"},
		"channel":      {"渠道", "来源渠道"},
		"region":       {"地区", "区域", "省份", "城市"},
		"user_segment": {"用户分层", "人群", "新客", "老客"},
	})

	timeRange := "last_30_days"
	granularity := "day"
	timeRules := []struct {
		pattern     *regexp.Regexp
		value       string
		granularity string
	}{
		{regexp.MustCompile(`近\s*7\s*天|最近\s*7\s*天`), "last_7_days", "day"},
		{regexp.MustCompile(`近\s*30\s*天|最近\s*30\s*天`), "last_30_days", "day"},
		{regexp.MustCompile(`本周|这周`), "this_week", "day"},
		{regexp.MustCompile(`上周`), "last_week", "day"},
		{regexp.MustCompile(`本月|这个月`), "this_month", "day"},
		{regexp.MustCompile(`上月`), "last_month", "day"},
		{regexp.MustCompile(`本年|今年`), "this_year", "month"},
	}
	for _, r := range timeRules {
		if r.pattern.MatchString(question) {
			timeRange = r.value
			granularity = r.granularity
			break
		}
	}

	intentType := "unknown"
	switch {
	case regexp.MustCompile(`为什么|原因|归因|下滑|下降|增长来源`).MatchString(question):
		intentType = "attribution"
	case regexp.MustCompile(`预测|预警|趋势|下周|下月`).MatchString(question):
		intentType = "forecast"
	case regexp.MustCompile(`告警|通知|超过|低于|阈值`).MatchString(question):
		intentType = "alert"
	case regexp.MustCompile(`环比|同比|对比|比较|vs`).MatchString(question):
		intentType = "comparison"
	case len(metrics) > 0:
		intentType = "current"
	}

	compareMode := "none"
	if regexp.MustCompile(`环比`).MatchString(question) {
		compareMode = "mom"
	} else if regexp.MustCompile(`同比`).MatchString(question) {
		compareMode = "yoy"
	} else if regexp.MustCompile(`渠道对比|渠道比较`).MatchString(question) {
		compareMode = "channel"
	}

	missing := make([]string, 0)
	if len(metrics) == 0 {
		missing = append(missing, "metric")
	}
	if timeRange == "last_30_days" && !regexp.MustCompile(`近\s*30\s*天|最近\s*30\s*天`).MatchString(question) {
		missing = append(missing, "timeRange")
	}

	return AnalysisIntent{
		Type:         intentType,
		Metrics:      metrics,
		Dimensions:   dimensions,
		Filters:      []map[string]interface{}{},
		TimeRange:    timeRange,
		Granularity:  granularity,
		CompareMode:  compareMode,
		MissingSlots: missing,
	}
}

func mapToSemantic(intent AnalysisIntent, question string) map[string]interface{} {
	synonymsHit := []string{}
	metricDict := map[string][]string{
		"gmv":             {"gmv", "销售额", "销售金额", "成交额", "营收", "revenue"},
		"order_count":     {"订单", "订单量", "单量"},
		"conversion_rate": {"转化率", "下单转化"},
		"customer_count":  {"客户数", "用户数", "买家数"},
	}
	lq := strings.ToLower(question)
	for metric, words := range metricDict {
		if contains(intent.Metrics, metric) {
			for _, word := range words {
				if strings.Contains(lq, strings.ToLower(word)) {
					synonymsHit = append(synonymsHit, fmt.Sprintf("%s->%s", word, metric))
					break
				}
			}
		}
	}
	metrics := intent.Metrics
	if len(metrics) == 0 {
		metrics = []string{"gmv"}
	}
	return map[string]interface{}{
		"metrics":     metrics,
		"dimensions":  intent.Dimensions,
		"timeRange":   intent.TimeRange,
		"synonymsHit": synonymsHit,
	}
}

func buildPlan(intent AnalysisIntent) AnalysisPlan {
	metricNames := intent.Metrics
	if len(metricNames) == 0 {
		metricNames = []string{"gmv"}
	}
	assumptions := []string{}
	if contains(intent.MissingSlots, "timeRange") {
		assumptions = append(assumptions, "未指定时间范围，默认近30天。")
	}
	if contains(intent.MissingSlots, "metric") {
		assumptions = append(assumptions, "未识别到指标，默认使用GMV。")
	}
	return AnalysisPlan{
		Objective:      fmt.Sprintf("围绕%s进行%s分析", strings.Join(metricNames, "、"), intent.Type),
		MetricNames:    metricNames,
		DimensionNames: intent.Dimensions,
		Filters:        intent.Filters,
		TimeRange:      intent.TimeRange,
		Granularity:    intent.Granularity,
		Steps: []string{
			"确认指标口径与时间窗口",
			"构建汇总查询并输出主结论",
			"按核心维度进行贡献拆解",
			"生成业务建议与后续追问方向",
		},
		Assumptions: assumptions,
	}
}

func generateSafeSQL(plan AnalysisPlan) string {
	metricExpr := map[string]string{
		"gmv":             "SUM(amount) AS gmv",
		"order_count":     "COUNT(*) AS order_count",
		"conversion_rate": "SUM(converted_users) * 1.0 / NULLIF(SUM(visitor_users), 0) AS conversion_rate",
		"customer_count":  "COUNT(DISTINCT customer_id) AS customer_count",
	}
	dimExpr := map[string]string{
		"category":     "category",
		"channel":      "channel",
		"region":       "region",
		"user_segment": "user_segment",
	}

	safeMetrics := make([]string, 0, len(plan.MetricNames))
	for _, m := range plan.MetricNames {
		if expr, ok := metricExpr[m]; ok {
			safeMetrics = append(safeMetrics, expr)
		} else {
			safeMetrics = append(safeMetrics, "COUNT(*) AS count_value")
		}
	}

	safeDims := make([]string, 0, len(plan.DimensionNames))
	for _, d := range plan.DimensionNames {
		if expr, ok := dimExpr[d]; ok {
			safeDims = append(safeDims, expr)
		}
	}

	selectPrefix := ""
	if len(safeDims) > 0 {
		selectPrefix = strings.Join(safeDims, ", ") + ", "
	}
	groupBy := ""
	if len(safeDims) > 0 {
		groupBy = " GROUP BY " + strings.Join(safeDims, ", ")
	}
	return fmt.Sprintf("SELECT %s%s FROM orders WHERE %s%s LIMIT 200",
		selectPrefix, strings.Join(safeMetrics, ", "), buildTimeFilter(plan.TimeRange), groupBy)
}

func runQualityChecks(sql string, intent AnalysisIntent) AnalysisQualityReport {
	checks := []map[string]interface{}{
		{"name": "sqlReadOnly", "ok": !regexp.MustCompile(`(?i)\b(UPDATE|DELETE|INSERT|DROP|ALTER)\b`).MatchString(sql), "reason": "仅允许只读查询"},
		{"name": "hasTimeFilter", "ok": regexp.MustCompile(`(?i)\bWHERE\b`).MatchString(sql), "reason": "必须包含时间过滤避免全表扫描"},
		{"name": "divisionGuard", "ok": !regexp.MustCompile(`/\s*SUM\(`).MatchString(sql) || strings.Contains(sql, "NULLIF"), "reason": "除法计算需防止分母为0"},
		{"name": "intentCompleteness", "ok": len(intent.MissingSlots) <= 1, "reason": "关键槽位缺失会降低结论可信度"},
	}

	issues := make([]string, 0)
	for _, c := range checks {
		if ok, _ := c["ok"].(bool); !ok {
			issues = append(issues, fmt.Sprintf("%s:%s", c["name"], c["reason"]))
		}
	}
	confidence := "high"
	if len(issues) == 1 {
		confidence = "medium"
	} else if len(issues) > 1 {
		confidence = "low"
	}
	return AnalysisQualityReport{Checks: checks, Confidence: confidence, Issues: issues}
}

func buildInsight(intent AnalysisIntent, quality AnalysisQualityReport) AnalysisInsight {
	metricText := "GMV"
	if len(intent.Metrics) > 0 {
		metricText = strings.Join(intent.Metrics, "、")
	}
	breakdown := []string{"建议先从渠道与区域两个维度进行下钻"}
	if len(intent.Dimensions) > 0 {
		breakdown = []string{"建议按 " + strings.Join(intent.Dimensions, "、") + " 进行贡献拆解"}
	}

	return AnalysisInsight{
		Conclusion:          fmt.Sprintf("当前问题可围绕 %s 在 %s 内完成%s分析。", metricText, formatTimeRange(intent.TimeRange), intent.Type),
		Evidence:            []string{"已识别指标: " + metricText, "时间范围: " + formatTimeRange(intent.TimeRange), "可信度: " + quality.Confidence},
		Breakdown:           breakdown,
		Suggestions:         []string{"先确认异常是否由单一维度驱动，再决定运营动作。", "若出现明显波动，补充环比/同比视角验证是否季节性变化。"},
		ChartRecommendation: chooseChart(intent),
	}
}

func buildClarification(intent AnalysisIntent) string {
	if len(intent.MissingSlots) == 0 {
		return ""
	}
	if contains(intent.MissingSlots, "metric") {
		return "你希望重点分析哪个指标？例如 GMV、订单量或转化率。"
	}
	if contains(intent.MissingSlots, "timeRange") {
		return "你希望看哪个时间范围？例如本周、上周或近30天。"
	}
	return "请补充分析指标和时间范围，我可以给出更准确的结论。"
}

func chooseChart(intent AnalysisIntent) string {
	if intent.Type == "comparison" {
		return "bar"
	}
	if intent.Type == "forecast" {
		return "line"
	}
	if len(intent.Dimensions) > 0 {
		return "stacked_bar"
	}
	return "table"
}

func extractSemanticKeys(q string, dict map[string][]string) []string {
	keys := make([]string, 0)
	for key, words := range dict {
		for _, word := range words {
			if strings.Contains(q, strings.ToLower(word)) {
				keys = append(keys, key)
				break
			}
		}
	}
	return keys
}

func buildTimeFilter(timeRange string) string {
	rules := map[string]string{
		"last_7_days":  "created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)",
		"last_30_days": "created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)",
		"this_week":    "YEARWEEK(created_at) = YEARWEEK(CURRENT_DATE)",
		"last_week":    "YEARWEEK(created_at) = YEARWEEK(CURRENT_DATE - INTERVAL 1 WEEK)",
		"this_month":   "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')",
		"last_month":   "DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL 1 MONTH, '%Y-%m')",
		"this_year":    "YEAR(created_at) = YEAR(CURRENT_DATE)",
	}
	if r, ok := rules[timeRange]; ok {
		return r
	}
	return rules["last_30_days"]
}

func formatTimeRange(timeRange string) string {
	m := map[string]string{
		"last_7_days":  "近7天",
		"last_30_days": "近30天",
		"this_week":    "本周",
		"last_week":    "上周",
		"this_month":   "本月",
		"last_month":   "上月",
		"this_year":    "今年",
	}
	if v, ok := m[timeRange]; ok {
		return v
	}
	return timeRange
}

func roundFloat(f float64, places int) float64 {
	shift := 1.0
	for i := 0; i < places; i++ {
		shift *= 10
	}
	return float64(int(f*shift+0.5)) / shift
}

func contains(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func generateAnalysisID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}
