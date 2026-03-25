package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

// RCAHandler 根因分析 API 处理器
type RCAHandler struct {
	rcaService *service.RCAService
}

// NewRCAHandler 创建 RCA Handler
func NewRCAHandler(rcaService *service.RCAService) *RCAHandler {
	return &RCAHandler{rcaService: rcaService}
}

// HandleRCA 处理根因分析请求
// POST /api/tenants/{tenantId}/rca/analyze
func (h *RCAHandler) HandleRCA(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	tenantID := parts[2]

	// 判断子路径
	subPath := ""
	if len(parts) >= 5 {
		subPath = parts[4]
	}

	switch {
	case subPath == "analyze" && r.Method == http.MethodPost:
		h.analyzeRootCause(w, r, tenantID)
	case subPath == "" && r.Method == http.MethodGet:
		h.listAnalysisHistory(w, r, tenantID)
	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

// analyzeRootCause 执行根因分析
func (h *RCAHandler) analyzeRootCause(w http.ResponseWriter, r *http.Request, tenantID string) {
	var req service.RCARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	req.TenantID = tenantID

	if req.MetricID == "" {
		http.Error(w, "metricId is required", http.StatusBadRequest)
		return
	}

	result, err := h.rcaService.Analyze(req)
	if err != nil {
		http.Error(w, "Analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"result":  result,
	})
}

// listAnalysisHistory 获取分析历史（基于 anomaly events with root cause）
func (h *RCAHandler) listAnalysisHistory(w http.ResponseWriter, r *http.Request, tenantID string) {
	// 返回最近有根因分析结果的异常事件
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "RCA history endpoint - available via anomaly events with rootCause field",
	})
}
