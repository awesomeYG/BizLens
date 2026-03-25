package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type AnomalyHandler struct {
	anomalyService *service.AnomalyService
}

func NewAnomalyHandler(anomalyService *service.AnomalyService) *AnomalyHandler {
	return &AnomalyHandler{anomalyService: anomalyService}
}

// ListAnomalies 获取异常列表
func (h *AnomalyHandler) ListAnomalies(w http.ResponseWriter, r *http.Request) {
	// 从路径提取 tenantId: /api/tenants/{tenantId}/anomalies
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	tenantID := parts[2]

	status := r.URL.Query().Get("status")
	anomalyStatus := model.AnomalyStatus(status)

	anomalies, err := h.anomalyService.ListAnomalies(tenantID, anomalyStatus, 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"anomalies": anomalies,
	})
}

// TriggerDetection 手动触发异常检测
func (h *AnomalyHandler) TriggerDetection(w http.ResponseWriter, r *http.Request) {
	// 从路径提取 tenantId
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	tenantID := parts[2]

	var req struct {
		MetricID    string   `json:"metricId"`
		ActualValue float64  `json:"actualValue"`
		PlatformIDs []string `json:"platformIds"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	anomaly, err := h.anomalyService.DetectAnomaly(tenantID, req.MetricID, req.ActualValue)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if anomaly != nil && len(req.PlatformIDs) > 0 {
		h.anomalyService.NotifyAnomaly(tenantID, anomaly, req.PlatformIDs)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"anomaly": anomaly,
	})
}
