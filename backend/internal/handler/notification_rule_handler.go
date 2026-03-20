package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type NotificationRuleHandler struct {
	ruleService *service.NotificationRuleService
}

func NewNotificationRuleHandler(ruleService *service.NotificationRuleService) *NotificationRuleHandler {
	return &NotificationRuleHandler{ruleService: ruleService}
}

// ListNotificationRules GET /api/tenants/{id}/notification-rules
func (h *NotificationRuleHandler) ListNotificationRules(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	rules, err := h.ruleService.ListRules(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rules)
}

// GetNotificationRule GET /api/tenants/{id}/notification-rules/{id}
func (h *NotificationRuleHandler) GetNotificationRule(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	ruleID := parts[len(parts)-1]

	rule, err := h.ruleService.GetRule(tenantID, ruleID)
	if err != nil {
		writeError(w, http.StatusNotFound, "规则不存在")
		return
	}
	writeJSON(w, http.StatusOK, rule)
}

// CreateNotificationRuleRequest 创建请求体
type CreateNotificationRuleRequest struct {
	Name            string                      `json:"name"`
	Description     string                      `json:"description"`
	Enabled         bool                        `json:"enabled"`
	RuleType        model.NotificationRuleType  `json:"ruleType"`
	Frequency       model.NotificationFrequency `json:"frequency"`
	DataSourceID    string                      `json:"dataSourceId,omitempty"`
	TableName       string                      `json:"tableName,omitempty"`
	MetricField     string                      `json:"metricField,omitempty"`
	DimensionField  string                      `json:"dimensionField,omitempty"`
	ConditionType   model.AlertConditionType    `json:"conditionType,omitempty"`
	Threshold       float64                     `json:"threshold,omitempty"`
	ConditionExpr   string                      `json:"conditionExpr,omitempty"`
	ScheduleTime    string                      `json:"scheduleTime,omitempty"`
	TimeRange       string                      `json:"timeRange,omitempty"`
	MessageTemplate string                      `json:"messageTemplate,omitempty"`
	MessageTitle    string                      `json:"messageTitle,omitempty"`
	PlatformIDs     string                      `json:"platformIds,omitempty"`
	WebhookURL      string                      `json:"webhookUrl,omitempty"`
	NLQuery         string                      `json:"nlQuery,omitempty"`
}

// CreateNotificationRule POST /api/tenants/{id}/notification-rules
func (h *NotificationRuleHandler) CreateNotificationRule(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req CreateNotificationRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Name == "" || req.RuleType == "" {
		writeError(w, http.StatusBadRequest, "name 和 ruleType 必填")
		return
	}

	rule := &model.NotificationRule{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Name:            req.Name,
		Description:     req.Description,
		Enabled:         req.Enabled,
		RuleType:        req.RuleType,
		Frequency:       req.Frequency,
		DataSourceID:    req.DataSourceID,
		TableName:       req.TableName,
		MetricField:     req.MetricField,
		DimensionField:  req.DimensionField,
		ConditionType:   req.ConditionType,
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

	if err := h.ruleService.CreateRule(tenantID, rule); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, rule)
}

// UpdateNotificationRule PUT /api/tenants/{id}/notification-rules/{id}
func (h *NotificationRuleHandler) UpdateNotificationRule(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	ruleID := parts[len(parts)-1]

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	rule, err := h.ruleService.UpdateRule(tenantID, ruleID, updates)
	if err != nil {
		writeError(w, http.StatusNotFound, "更新失败")
		return
	}

	writeJSON(w, http.StatusOK, rule)
}

// DeleteNotificationRule DELETE /api/tenants/{id}/notification-rules/{id}
func (h *NotificationRuleHandler) DeleteNotificationRule(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	ruleID := parts[len(parts)-1]

	if err := h.ruleService.DeleteRule(tenantID, ruleID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusNoContent, nil)
}

// ToggleNotificationRule POST /api/tenants/{id}/notification-rules/{id}/toggle
func (h *NotificationRuleHandler) ToggleNotificationRule(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	ruleID := parts[len(parts)-2]

	rule, err := h.ruleService.ToggleRule(tenantID, ruleID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, rule)
}

// TriggerNotificationRule POST /api/tenants/{id}/notification-rules/{id}/trigger
func (h *NotificationRuleHandler) TriggerNotificationRule(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	ruleID := parts[len(parts)-2]

	result, err := h.ruleService.TriggerRule(tenantID, ruleID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// ParseNLQueryRequest 自然语言解析请求体
type ParseNLQueryRequest struct {
	Query string `json:"query"`
}

// ParseNLQuery POST /api/tenants/{id}/notification-rules/parse-nl
func (h *NotificationRuleHandler) ParseNLQuery(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req ParseNLQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Query == "" {
		writeError(w, http.StatusBadRequest, "query 必填")
		return
	}

	result, err := h.ruleService.ParseNaturalLanguage(tenantID, req.Query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}
