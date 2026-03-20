package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type AlertHandler struct {
	alertService *service.AlertService
}

func NewAlertHandler(alertService *service.AlertService) *AlertHandler {
	return &AlertHandler{alertService: alertService}
}

// ListAlertEvents GET /api/tenants/{id}/alerts
func (h *AlertHandler) ListAlertEvents(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}
	events, err := h.alertService.ListEvents(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, events)
}

// GetAlertEvent GET /api/tenants/{id}/alerts/{eventId}
func (h *AlertHandler) GetAlertEvent(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	eventID := parts[len(parts)-1]

	event, err := h.alertService.GetEvent(tenantID, eventID)
	if err != nil {
		writeError(w, http.StatusNotFound, "告警事件不存在")
		return
	}
	writeJSON(w, http.StatusOK, event)
}

// CreateAlertEventRequest 创建告警请求体
type CreateAlertEventRequest struct {
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	Metric        string  `json:"metric"`
	ConditionType string  `json:"conditionType"`
	Threshold     float64 `json:"threshold"`
	Message       string  `json:"message"`
	PlatformIDs   string  `json:"platformIds"`
	Enabled       bool    `json:"enabled"`
}

// CreateAlertEvent POST /api/tenants/{id}/alerts
func (h *AlertHandler) CreateAlertEvent(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req CreateAlertEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Name == "" || req.Metric == "" || req.Message == "" {
		writeError(w, http.StatusBadRequest, "name, metric, message 必填")
		return
	}

	event := &model.AlertEvent{
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
	writeJSON(w, http.StatusCreated, event)
}

// UpdateAlertEvent PUT /api/tenants/{id}/alerts/{eventId}
func (h *AlertHandler) UpdateAlertEvent(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	eventID := parts[len(parts)-1]

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	event, err := h.alertService.UpdateEvent(tenantID, eventID, updates)
	if err != nil {
		writeError(w, http.StatusNotFound, "更新失败")
		return
	}
	writeJSON(w, http.StatusOK, event)
}

// DeleteAlertEvent DELETE /api/tenants/{id}/alerts/{eventId}
func (h *AlertHandler) DeleteAlertEvent(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	eventID := parts[len(parts)-1]

	if err := h.alertService.DeleteEvent(tenantID, eventID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// TriggerAlertRequest 触发告警请求体
type TriggerAlertRequest struct {
	ActualValue float64 `json:"actualValue"`
}

// TriggerAlertEvent POST /api/tenants/{id}/alerts/{eventId}/trigger
func (h *AlertHandler) TriggerAlertEvent(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	eventID := parts[len(parts)-2]

	var req TriggerAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	log, err := h.alertService.TriggerEvent(tenantID, eventID, req.ActualValue)
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
		"log":       log,
	})
}

// ListTriggerLogs GET /api/tenants/{id}/alerts/logs
func (h *AlertHandler) ListTriggerLogs(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}
	logs, err := h.alertService.ListTriggerLogs(tenantID, 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, logs)
}
