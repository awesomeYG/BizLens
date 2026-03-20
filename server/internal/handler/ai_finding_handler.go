package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

// AIFindingHandler AI 发现处理器
type AIFindingHandler struct {
	service *service.AIFindingService
}

// NewAIFindingHandler 创建 AI 发现处理器
func NewAIFindingHandler(service *service.AIFindingService) *AIFindingHandler {
	return &AIFindingHandler{service: service}
}

// ListFindings 获取发现列表
func (h *AIFindingHandler) ListFindings(w http.ResponseWriter, r *http.Request) {
	// /api/tenants/{id}/ai-findings[?type=xxx]
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	findingType := r.URL.Query().Get("type")

	findings, err := h.service.ListFindings(tenantID, "", model.AIFindingType(findingType))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(findings)
}

// ListDataSourceFindings 获取数据源的发现列表
func (h *AIFindingHandler) ListDataSourceFindings(w http.ResponseWriter, r *http.Request) {
	// /api/tenants/{id}/data-sources/{dsId}/ai-findings[?type=xxx]
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]
	findingType := r.URL.Query().Get("type")

	findings, err := h.service.ListFindings(tenantID, dataSourceID, model.AIFindingType(findingType))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(findings)
}

// GetFindingStats 获取发现统计
func (h *AIFindingHandler) GetFindingStats(w http.ResponseWriter, r *http.Request) {
	// /api/tenants/{id}/data-sources/{dsId}/ai-findings/stats
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	stats, err := h.service.GetFindingStats(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GetInsightSummary 获取洞察摘要
func (h *AIFindingHandler) GetInsightSummary(w http.ResponseWriter, r *http.Request) {
	// /api/tenants/{id}/data-sources/{dsId}/ai-findings/summary
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	summary, err := h.service.GetInsightSummary(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(summary))
}

// TriggerRediscovery 触发重新发现
func (h *AIFindingHandler) TriggerRediscovery(w http.ResponseWriter, r *http.Request) {
	// POST /api/tenants/{id}/data-sources/{dsId}/ai-findings/rediscover
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	if err := h.service.TriggerReDiscovery(tenantID, dataSourceID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// DeleteFinding 删除发现
func (h *AIFindingHandler) DeleteFinding(w http.ResponseWriter, r *http.Request) {
	// DELETE /api/tenants/{id}/ai-findings/{findingId}
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	findingID := parts[2]

	if err := h.service.DeleteFinding(findingID, tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
