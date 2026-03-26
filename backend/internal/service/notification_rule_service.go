package service

import (
	"ai-bi-server/internal/model"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

// NotificationRuleService 通知规则服务
type NotificationRuleService struct {
	db        *gorm.DB
	imService *IMService
}

func NewNotificationRuleService(db *gorm.DB, imService *IMService) *NotificationRuleService {
	return &NotificationRuleService{
		db:        db,
		imService: imService,
	}
}

// ListRules 获取租户下所有通知规则
func (s *NotificationRuleService) ListRules(tenantID string) ([]model.NotificationRule, error) {
	var rules []model.NotificationRule
	err := s.db.Where("tenant_id = ?", tenantID).Order("created_at DESC").Find(&rules).Error
	return rules, err
}

// GetRule 获取单个规则
func (s *NotificationRuleService) GetRule(tenantID, id string) (*model.NotificationRule, error) {
	var rule model.NotificationRule
	err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// CreateRule 创建通知规则
func (s *NotificationRuleService) CreateRule(tenantID string, rule *model.NotificationRule) error {
	rule.TenantID = tenantID
	if rule.Frequency == "" {
		rule.Frequency = model.FreqOnce
	}
	return s.db.Create(rule).Error
}

// UpdateRule 更新通知规则
func (s *NotificationRuleService) UpdateRule(tenantID, id string, updates map[string]interface{}) (*model.NotificationRule, error) {
	var rule model.NotificationRule
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&rule).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&rule).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

// DeleteRule 删除通知规则（软删除）
func (s *NotificationRuleService) DeleteRule(tenantID, id string) error {
	result := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&model.NotificationRule{})
	if result.RowsAffected == 0 {
		return errors.New("规则不存在")
	}
	return result.Error
}

// ToggleRule 切换规则启用状态
func (s *NotificationRuleService) ToggleRule(tenantID, id string) (*model.NotificationRule, error) {
	var rule model.NotificationRule
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&rule).Error; err != nil {
		return nil, err
	}

	rule.Enabled = !rule.Enabled
	if err := s.db.Save(&rule).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

// TriggerRule 手动触发规则
func (s *NotificationRuleService) TriggerRule(tenantID, ruleID string) (map[string]interface{}, error) {
	rule, err := s.GetRule(tenantID, ruleID)
	if err != nil {
		return nil, err
	}

	// 执行规则检测
	result, err := s.evaluateRule(rule)
	if err != nil {
		return nil, err
	}

	// 如果满足条件，发送通知
	if triggered, ok := result["triggered"].(bool); ok && triggered {
		platformIDs := strings.Split(rule.PlatformIDs, ",")
		_, err := s.imService.SendNotification(
			tenantID,
			platformIDs,
			rule.MessageTitle,
			rule.MessageTemplate,
			true,
		)
		if err != nil {
			return map[string]interface{}{
				"success":   false,
				"error":     err.Error(),
				"triggered": true,
				"data":      result["data"],
			}, err
		}

		return map[string]interface{}{
			"success":   true,
			"triggered": true,
			"data":      result["data"],
			"message":   "通知已发送",
		}, nil
	}

	return map[string]interface{}{
		"success":   true,
		"triggered": false,
		"data":      result["data"],
		"message":   "未满足触发条件",
	}, nil
}

// evaluateRule 评估规则是否满足触发条件
func (s *NotificationRuleService) evaluateRule(rule *model.NotificationRule) (map[string]interface{}, error) {
	if rule.DataSourceID == "" {
		return map[string]interface{}{
			"triggered": false,
			"data":      nil,
			"error":     "未配置数据源",
		}, nil
	}

	// 获取数据源配置
	var dataSource model.DataSource
	if err := s.db.First(&dataSource, rule.DataSourceID).Error; err != nil {
		return map[string]interface{}{
			"triggered": false,
			"data":      nil,
			"error":     "数据源不存在",
		}, err
	}

	// 根据数据源类型执行查询
	switch dataSource.Type {
	case model.DataSourceMySQL, model.DataSourcePostgreSQL:
		return s.evaluateSQLRule(rule, &dataSource)
	default:
		return map[string]interface{}{
			"triggered": false,
			"data":      nil,
			"error":     "不支持的数据源类型",
		}, nil
	}
}

// evaluateSQLRule 评估 SQL 数据源的规则
func (s *NotificationRuleService) evaluateSQLRule(rule *model.NotificationRule, dataSource *model.DataSource) (map[string]interface{}, error) {
	// 构建 SQL 查询
	var query string

	// 时间范围过滤
	timeFilter := s.buildTimeFilter(rule.TimeRange)

	switch rule.RuleType {
	case model.RuleTypeDataThreshold, model.RuleTypeDataChange:
		// 聚合查询指标值
		query = fmt.Sprintf("SELECT COALESCE(SUM(%s), 0) as value FROM %s", rule.MetricField, rule.TableName)
		if timeFilter != "" {
			query += " WHERE " + timeFilter
		}
	case model.RuleTypeCustom:
		// 自定义条件查询
		query = fmt.Sprintf("SELECT COUNT(*) as value FROM %s WHERE %s", rule.TableName, rule.ConditionExpr)
	default:
		return map[string]interface{}{
			"triggered": false,
			"data":      nil,
			"error":     "不支持的规则类型",
		}, nil
	}

	// 执行查询（这里简化处理，实际需要建立数据库连接）
	// TODO: 实现动态数据库连接和查询执行

	// 模拟返回值
	currentValue := 1200.0 // 示例值

	return map[string]interface{}{
		"triggered": s.checkCondition(rule, currentValue),
		"data": map[string]interface{}{
			"current_value": currentValue,
			"threshold":     rule.Threshold,
			"query":         query,
		},
	}, nil
}

// buildTimeFilter 构建时间范围过滤条件
func (s *NotificationRuleService) buildTimeFilter(timeRange string) string {
	now := time.Now()

	switch timeRange {
	case "today":
		return fmt.Sprintf("DATE(created_at) = '%s'", now.Format("2006-01-02"))
	case "yesterday":
		yesterday := now.AddDate(0, 0, -1)
		return fmt.Sprintf("DATE(created_at) = '%s'", yesterday.Format("2006-01-02"))
	case "last_7_days":
		lastWeek := now.AddDate(0, 0, -7)
		return fmt.Sprintf("created_at >= '%s'", lastWeek.Format("2006-01-02"))
	case "last_30_days":
		lastMonth := now.AddDate(0, 0, -30)
		return fmt.Sprintf("created_at >= '%s'", lastMonth.Format("2006-01-02"))
	default:
		return ""
	}
}

// checkCondition 检查是否满足触发条件
func (s *NotificationRuleService) checkCondition(rule *model.NotificationRule, currentValue float64) bool {
	switch rule.ConditionType {
	case model.AlertCondGreater:
		return currentValue > rule.Threshold
	case model.AlertCondLess:
		return currentValue < rule.Threshold
	case model.AlertCondEquals:
		return currentValue == rule.Threshold
	case model.AlertCondCustom:
		// 自定义条件表达式解析
		return s.evaluateCustomCondition(rule.ConditionExpr, currentValue)
	default:
		return false
	}
}

// evaluateCustomCondition 评估自定义条件
func (s *NotificationRuleService) evaluateCustomCondition(expr string, value float64) bool {
	// 简单的表达式解析，支持 ">1000", "<500", "=100" 等格式
	expr = strings.TrimSpace(expr)

	re := regexp.MustCompile(`^([><=]+)\s*([\d.]+)$`)
	matches := re.FindStringSubmatch(expr)
	if len(matches) != 3 {
		return false
	}

	op := matches[1]
	threshold, _ := strconv.ParseFloat(matches[2], 64)

	switch op {
	case ">":
		return value > threshold
	case ">=":
		return value >= threshold
	case "<":
		return value < threshold
	case "<=":
		return value <= threshold
	case "=", "==":
		return value == threshold
	default:
		return false
	}
}

// NLQueryParseResult 自然语言解析结果
type NLQueryParseResult struct {
	Success       bool                    `json:"success"`
	RuleConfig    *model.NotificationRule `json:"ruleConfig,omitempty"`
	Message       string                  `json:"message,omitempty"`
	Suggestions   []string                `json:"suggestions,omitempty"`
	MissingFields []string                `json:"missingFields,omitempty"`
}

// ParseNaturalLanguage 解析自然语言查询，生成通知规则配置
func (s *NotificationRuleService) ParseNaturalLanguage(tenantID string, query string) (*NLQueryParseResult, error) {
	query = strings.TrimSpace(query)

	result := &NLQueryParseResult{
		Suggestions:   []string{},
		MissingFields: []string{},
	}

	// 使用简单的规则匹配来解析自然语言
	// TODO: 未来可以集成 LLM 来更智能地解析

	rule := &model.NotificationRule{
		TenantID: tenantID,
		Name:     s.extractRuleName(query),
		NLQuery:  query,
	}

	// 检测通知类型
	if strings.Contains(query, "钉钉") || strings.Contains(query, "dingtalk") {
		rule.PlatformIDs = "dingtalk" // 需要用户后续选择具体配置
		result.Suggestions = append(result.Suggestions, "检测到钉钉通知需求，请选择具体的钉钉机器人配置")
	}
	if strings.Contains(query, "飞书") || strings.Contains(query, "feishu") {
		result.Suggestions = append(result.Suggestions, "检测到飞书通知需求")
	}
	if strings.Contains(query, "企业微信") || strings.Contains(query, "wecom") {
		result.Suggestions = append(result.Suggestions, "检测到企业微信通知需求")
	}

	// 检测阈值条件
	thresholdPatterns := []struct {
		keyword string
		op      model.AlertConditionType
	}{
		{"超过", model.AlertCondGreater},
		{"大于", model.AlertCondGreater},
		{"高于", model.AlertCondGreater},
		{"破", model.AlertCondGreater},
		{"小于", model.AlertCondLess},
		{"低于", model.AlertCondLess},
		{"等于", model.AlertCondEquals},
	}

	for _, pattern := range thresholdPatterns {
		if strings.Contains(query, pattern.keyword) {
			rule.ConditionType = pattern.op
			// 提取数字
			re := regexp.MustCompile(`(\d+(?:\.\d+)?)`)
			matches := re.FindStringSubmatch(query)
			if len(matches) > 1 {
				rule.Threshold, _ = strconv.ParseFloat(matches[1], 64)
			} else {
				result.MissingFields = append(result.MissingFields, "threshold")
				result.Suggestions = append(result.Suggestions, "请指定具体的阈值数字")
			}
			break
		}
	}

	// 检测指标字段
	metricKeywords := []string{"销售额", "收入", "营收", "销量", "订单量", "用户数", "访问量", "PV", "UV"}
	for _, keyword := range metricKeywords {
		if strings.Contains(query, keyword) {
			rule.MetricField = s.mapMetricToField(keyword)
			break
		}
	}
	if rule.MetricField == "" {
		result.MissingFields = append(result.MissingFields, "metricField")
		result.Suggestions = append(result.Suggestions, "请指定要监控的指标（如销售额、订单量等）")
	}

	// 检测时间范围
	timeRangePatterns := map[string]string{
		"今日":      "today",
		"今天":      "today",
		"当日":      "today",
		"昨日":      "yesterday",
		"昨天":      "yesterday",
		"近 7 天":   "last_7_days",
		"最近 7 天":  "last_7_days",
		"近 30 天":  "last_30_days",
		"最近 30 天": "last_30_days",
		"本月":      "this_month",
	}

	for keyword, timeRange := range timeRangePatterns {
		if strings.Contains(query, keyword) {
			rule.TimeRange = timeRange
			break
		}
	}

	// 设置默认值
	if rule.RuleType == "" {
		rule.RuleType = model.RuleTypeDataThreshold
	}
	if rule.Frequency == "" {
		rule.Frequency = model.FreqOnce
	}
	if rule.ConditionType == "" {
		rule.ConditionType = model.AlertCondGreater
	}

	// 生成消息模板
	if rule.MetricField != "" && rule.Threshold > 0 {
		rule.MessageTitle = fmt.Sprintf("🔔 %s - 阈值告警", rule.Name)
		rule.MessageTemplate = s.generateMessageTemplate(rule)
	}

	result.RuleConfig = rule
	result.Success = len(result.MissingFields) == 0
	result.Message = s.generateParseMessage(result)

	return result, nil
}

// extractRuleName 从查询中提取规则名称
func (s *NotificationRuleService) extractRuleName(query string) string {
	// 简单的提取逻辑：取前 20 个字符作为名称
	if len(query) > 20 {
		return query[:20]
	}
	return query
}

// mapMetricToField 将中文指标映射到数据库字段
func (s *NotificationRuleService) mapMetricToField(keyword string) string {
	mapping := map[string]string{
		"销售额": "sales_amount",
		"收入":  "revenue",
		"营收":  "revenue",
		"销量":  "sales_count",
		"订单量": "order_count",
		"用户数": "user_count",
		"访问量": "visit_count",
		"PV":  "page_views",
		"UV":  "unique_visitors",
	}

	if field, ok := mapping[keyword]; ok {
		return field
	}

	// 默认返回小写的 keyword
	return strings.ToLower(keyword)
}

// generateMessageTemplate 生成消息模板
func (s *NotificationRuleService) generateMessageTemplate(rule *model.NotificationRule) string {
	template := "## %s\n\n"
	template += "**指标**: %s\n"
	template += "**当前值**: {{current_value}}\n"
	template += "**阈值**: %.2f\n"
	template += "**时间范围**: %s\n"
	template += "**触发时间**: {{trigger_time}}\n"

	timeRangeDesc := rule.TimeRange
	if timeRangeDesc == "" {
		timeRangeDesc = "实时"
	}

	return fmt.Sprintf(template, rule.Name, rule.MetricField, rule.Threshold, timeRangeDesc)
}

// generateParseMessage 生成解析结果消息
func (s *NotificationRuleService) generateParseMessage(result *NLQueryParseResult) string {
	if result.Success {
		return "解析成功！已为您生成通知规则配置，请确认后保存。"
	}

	msg := "需要补充以下信息才能创建完整的通知规则：\n"
	for _, field := range result.MissingFields {
		switch field {
		case "metricField":
			msg += "- 要监控的指标（如销售额、订单量等）\n"
		case "threshold":
			msg += "- 触发通知的阈值\n"
		case "platformIds":
			msg += "- 通知发送的目标平台（钉钉/飞书/企业微信等）\n"
		}
	}
	return msg
}

// SendNotification 发送通知（封装 IM 服务）
func (s *NotificationRuleService) SendNotification(tenantID string, platformIDs []string, title, content string) error {
	_, err := s.imService.SendNotification(tenantID, platformIDs, title, content, true)
	return err
}
