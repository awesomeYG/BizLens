package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// AlertSourceType 告警来源类型
type AlertSourceType string

const (
	SourceQuickAlert AlertSourceType = "quick_alert" // 快速告警（手动/外部触发）
	SourceAutoRule   AlertSourceType = "auto_rule"   // 自动规则（定时/查库触发）
)

// UnifiedAlertHandler 统一告警与通知 Handler
// 合并了 AlertEvent（快速告警）和 NotificationRule（自动规则）的处理逻辑
type UnifiedAlertHandler struct {
	alertService            *service.AlertService
	notificationRuleService *service.NotificationRuleService
}

// NewUnifiedAlertHandler 创建统一的告警 Handler
func NewUnifiedAlertHandler(alertService *service.AlertService, notificationRuleService *service.NotificationRuleService) *UnifiedAlertHandler {
	return &UnifiedAlertHandler{
		alertService:            alertService,
		notificationRuleService: notificationRuleService,
	}
}

// UnifiedAlertItem 统一告警列表项（前端展示用）
type UnifiedAlertItem struct {
	ID          string          `json:"id"`
	Type        AlertSourceType `json:"type"` // quick_alert / auto_rule
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Enabled     bool            `json:"enabled"`
	// 快速告警字段
	Metric        string  `json:"metric,omitempty"`
	ConditionType string  `json:"conditionType,omitempty"`
	Threshold     float64 `json:"threshold,omitempty"`
	Message       string  `json:"message,omitempty"`
	PlatformIDs   string  `json:"platformIds,omitempty"`
	// 自动规则字段
	RuleType        string `json:"ruleType,omitempty"`
	Frequency       string `json:"frequency,omitempty"`
	DataSourceID    string `json:"dataSourceId,omitempty"`
	TableName       string `json:"tableName,omitempty"`
	MetricField     string `json:"metricField,omitempty"`
	ConditionExpr   string `json:"conditionExpr,omitempty"`
	ScheduleTime    string `json:"scheduleTime,omitempty"`
	TimeRange       string `json:"timeRange,omitempty"`
	MessageTemplate string `json:"messageTemplate,omitempty"`
	MessageTitle    string `json:"messageTitle,omitempty"`
	WebhookURL      string `json:"webhookUrl,omitempty"`
	NLQuery         string `json:"nlQuery,omitempty"`
	// 通用字段
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// UnifiedAlertCreateRequest 统一创建请求
type UnifiedAlertCreateRequest struct {
	Type        AlertSourceType `json:"type"` // quick_alert / auto_rule
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Enabled     bool            `json:"enabled"`
	// 快速告警字段
	Metric        string  `json:"metric,omitempty"`
	ConditionType string  `json:"conditionType,omitempty"`
	Threshold     float64 `json:"threshold,omitempty"`
	Message       string  `json:"message,omitempty"`
	PlatformIDs   string  `json:"platformIds,omitempty"`
	// 自动规则字段
	RuleType        string `json:"ruleType,omitempty"`
	Frequency       string `json:"frequency,omitempty"`
	DataSourceID    string `json:"dataSourceId,omitempty"`
	TableName       string `json:"tableName,omitempty"`
	MetricField     string `json:"metricField,omitempty"`
	ConditionExpr   string `json:"conditionExpr,omitempty"`
	ScheduleTime    string `json:"scheduleTime,omitempty"`
	TimeRange       string `json:"timeRange,omitempty"`
	MessageTemplate string `json:"messageTemplate,omitempty"`
	MessageTitle    string `json:"messageTitle,omitempty"`
	WebhookURL      string `json:"webhookUrl,omitempty"`
	NLQuery         string `json:"nlQuery,omitempty"`
}

// toUnifiedItem 将 AlertEvent 转换为统一项
func toUnifiedItem(event *model.AlertEvent) UnifiedAlertItem {
	return UnifiedAlertItem{
		ID:            event.ID,
		Type:          SourceQuickAlert,
		Name:          event.Name,
		Description:   event.Description,
		Enabled:       event.Enabled,
		Metric:        event.Metric,
		ConditionType: string(event.ConditionType),
		Threshold:     event.Threshold,
		Message:       event.Message,
		PlatformIDs:   event.PlatformIDs,
		CreatedAt:     event.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:     event.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

// toUnifiedItemFromRule 将 NotificationRule 转换为统一项
func toUnifiedItemFromRule(rule *model.NotificationRule) UnifiedAlertItem {
	return UnifiedAlertItem{
		ID:              rule.ID,
		Type:            SourceAutoRule,
		Name:            rule.Name,
		Description:     rule.Description,
		Enabled:         rule.Enabled,
		RuleType:        string(rule.RuleType),
		Frequency:       string(rule.Frequency),
		DataSourceID:    rule.DataSourceID,
		TableName:       rule.TableName,
		MetricField:     rule.MetricField,
		ConditionType:   string(rule.ConditionType),
		Threshold:       rule.Threshold,
		ConditionExpr:   rule.ConditionExpr,
		ScheduleTime:    rule.ScheduleTime,
		TimeRange:       rule.TimeRange,
		MessageTemplate: rule.MessageTemplate,
		MessageTitle:    rule.MessageTitle,
		PlatformIDs:     rule.PlatformIDs,
		WebhookURL:      rule.WebhookURL,
		NLQuery:         rule.NLQuery,
		CreatedAt:       rule.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:       rule.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

// ListUnifiedAlerts GET /api/tenants/{id}/alerts
// 返回合并后的告警列表，支持 ?type=quick_alert|auto_rule 筛选
func (h *UnifiedAlertHandler) ListUnifiedAlerts(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	sourceType := r.URL.Query().Get("type")

	var result []UnifiedAlertItem

	if sourceType == "" || sourceType == string(SourceQuickAlert) {
		events, err := h.alertService.ListEvents(tenantID)
		if err == nil {
			for i := range events {
				result = append(result, toUnifiedItem(&events[i]))
			}
		}
	}

	if sourceType == "" || sourceType == string(SourceAutoRule) {
		rules, err := h.notificationRuleService.ListRules(tenantID)
		if err == nil {
			for i := range rules {
				result = append(result, toUnifiedItemFromRule(&rules[i]))
			}
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// CreateUnifiedAlert POST /api/tenants/{id}/alerts
func (h *UnifiedAlertHandler) CreateUnifiedAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req UnifiedAlertCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name 必填")
		return
	}

	if req.Type == "" {
		req.Type = SourceQuickAlert // 默认快速告警
	}

	switch req.Type {
	case SourceQuickAlert:
		h.createQuickAlert(tenantID, req, w, r)
	case SourceAutoRule:
		h.createAutoRule(tenantID, req, w, r)
	default:
		writeError(w, http.StatusBadRequest, "不支持的 type")
	}
}

// createQuickAlert 创建快速告警
func (h *UnifiedAlertHandler) createQuickAlert(tenantID string, req UnifiedAlertCreateRequest, w http.ResponseWriter, r *http.Request) {
	if req.Metric == "" || req.Message == "" {
		writeError(w, http.StatusBadRequest, "快速告警：metric 和 message 必填")
		return
	}

	event := &model.AlertEvent{
		ID:            uuid.New().String(),
		Name:          req.Name,
		Description:   req.Description,
		Enabled:       req.Enabled,
		Metric:        req.Metric,
		ConditionType: model.AlertConditionType(req.ConditionType),
		Threshold:     req.Threshold,
		Message:       req.Message,
		PlatformIDs:   req.PlatformIDs,
	}

	if err := h.alertService.CreateEvent(tenantID, event); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, toUnifiedItem(event))
}

// createAutoRule 创建自动规则
func (h *UnifiedAlertHandler) createAutoRule(tenantID string, req UnifiedAlertCreateRequest, w http.ResponseWriter, r *http.Request) {
	if req.RuleType == "" {
		writeError(w, http.StatusBadRequest, "自动规则：ruleType 必填")
		return
	}

	rule := &model.NotificationRule{
		ID:              uuid.New().String(),
		Name:            req.Name,
		Description:     req.Description,
		Enabled:         req.Enabled,
		RuleType:        model.NotificationRuleType(req.RuleType),
		Frequency:       model.NotificationFrequency(req.Frequency),
		DataSourceID:    req.DataSourceID,
		TableName:       req.TableName,
		MetricField:     req.MetricField,
		ConditionType:   model.AlertConditionType(req.ConditionType),
		Threshold:       req.Threshold,
		ConditionExpr:   req.ConditionExpr,
		ScheduleTime:    req.ScheduleTime,
		TimeRange:       req.TimeRange,
		MessageTemplate: req.MessageTemplate,
		MessageTitle:    req.MessageTitle,
		PlatformIDs:     req.PlatformIDs,
		WebhookURL:      req.WebhookURL,
		NLQuery:         req.NLQuery,
	}

	if err := h.notificationRuleService.CreateRule(tenantID, rule); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, toUnifiedItemFromRule(rule))
}

// GetUnifiedAlert GET /api/tenants/{id}/alerts/{id}
func (h *UnifiedAlertHandler) GetUnifiedAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	alertID := parts[len(parts)-1]

	// 先尝试快速告警
	event, err := h.alertService.GetEvent(tenantID, alertID)
	if err == nil {
		writeJSON(w, http.StatusOK, toUnifiedItem(event))
		return
	}

	// 再尝试自动规则
	rule, err := h.notificationRuleService.GetRule(tenantID, alertID)
	if err == nil {
		writeJSON(w, http.StatusOK, toUnifiedItemFromRule(rule))
		return
	}

	writeError(w, http.StatusNotFound, "告警/规则不存在")
}

// UpdateUnifiedAlert PUT /api/tenants/{id}/alerts/{id}
func (h *UnifiedAlertHandler) UpdateUnifiedAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	alertID := parts[len(parts)-1]

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	// 先尝试快速告警
	if _, err := h.alertService.GetEvent(tenantID, alertID); err == nil {
		event, err := h.alertService.UpdateEvent(tenantID, alertID, updates)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, toUnifiedItem(event))
		return
	}

	// 再尝试自动规则
	rule, err := h.notificationRuleService.GetRule(tenantID, alertID)
	if err == nil {
		_ = rule // 避免未使用警告
		rule, err := h.notificationRuleService.UpdateRule(tenantID, alertID, updates)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, toUnifiedItemFromRule(rule))
		return
	}

	writeError(w, http.StatusNotFound, "告警/规则不存在")
}

// DeleteUnifiedAlert DELETE /api/tenants/{id}/alerts/{id}
func (h *UnifiedAlertHandler) DeleteUnifiedAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	alertID := parts[len(parts)-1]

	// 先尝试快速告警
	if err := h.alertService.DeleteEvent(tenantID, alertID); err == nil {
		writeJSON(w, http.StatusNoContent, nil)
		return
	}

	// 再尝试自动规则
	if err := h.notificationRuleService.DeleteRule(tenantID, alertID); err == nil {
		writeJSON(w, http.StatusNoContent, nil)
		return
	}

	writeError(w, http.StatusNotFound, "告警/规则不存在")
}

// ToggleUnifiedAlert POST /api/tenants/{id}/alerts/{id}/toggle
func (h *UnifiedAlertHandler) ToggleUnifiedAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	alertID := parts[len(parts)-2]

	// 先尝试快速告警
	if event, err := h.alertService.GetEvent(tenantID, alertID); err == nil {
		updates := map[string]interface{}{"enabled": !event.Enabled}
		event, err := h.alertService.UpdateEvent(tenantID, alertID, updates)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, toUnifiedItem(event))
		return
	}

	// 再尝试自动规则
	if rule, err := h.notificationRuleService.ToggleRule(tenantID, alertID); err == nil {
		writeJSON(w, http.StatusOK, toUnifiedItemFromRule(rule))
		return
	}

	writeError(w, http.StatusNotFound, "告警/规则不存在")
}

// TriggerUnifiedAlert POST /api/tenants/{id}/alerts/{id}/trigger
func (h *UnifiedAlertHandler) TriggerUnifiedAlert(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	alertID := parts[len(parts)-2]

	// 先尝试快速告警
	if _, err := h.alertService.GetEvent(tenantID, alertID); err == nil {
		var req struct {
			ActualValue float64 `json:"actualValue"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "请求体解析失败")
			return
		}
		log, err := h.alertService.TriggerEvent(tenantID, alertID, req.ActualValue, string(SourceQuickAlert))
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if log == nil {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"triggered": false,
				"message":   "条件未满足，未触发告警",
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"triggered": true,
			"type":      SourceQuickAlert,
			"log":       log,
		})
		return
	}

	// 再尝试自动规则
	if _, err := h.notificationRuleService.GetRule(tenantID, alertID); err == nil {
		result, err := h.notificationRuleService.TriggerRule(tenantID, alertID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"triggered": result["success"],
			"type":      SourceAutoRule,
			"data":      result,
		})
		return
	}

	writeError(w, http.StatusNotFound, "告警/规则不存在")
}

// ParseNLQuery POST /api/tenants/{id}/alerts/parse-nl
func (h *UnifiedAlertHandler) ParseNLQuery(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Query == "" {
		writeError(w, http.StatusBadRequest, "query 必填")
		return
	}

	result, err := h.notificationRuleService.ParseNaturalLanguage(tenantID, req.Query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}
