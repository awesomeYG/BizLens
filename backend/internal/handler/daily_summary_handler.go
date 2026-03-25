package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

// DailySummaryHandler 每日摘要 API 处理器
type DailySummaryHandler struct {
	summaryService *service.DailySummaryService
}

// NewDailySummaryHandler 创建每日摘要 Handler
func NewDailySummaryHandler(summaryService *service.DailySummaryService) *DailySummaryHandler {
	return &DailySummaryHandler{summaryService: summaryService}
}

// HandleDailySummary 每日摘要入口路由
// GET  /api/tenants/{tenantId}/daily-summary          -- 查询历史摘要
// GET  /api/tenants/{tenantId}/daily-summary/latest    -- 最新摘要
// POST /api/tenants/{tenantId}/daily-summary/generate  -- 手动触发生成
func (h *DailySummaryHandler) HandleDailySummary(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	tenantID := parts[2]

	subPath := ""
	if len(parts) >= 5 {
		subPath = parts[4]
	}

	switch {
	case subPath == "" && r.Method == http.MethodGet:
		h.listSummaries(w, r, tenantID)
	case subPath == "latest" && r.Method == http.MethodGet:
		h.getLatestSummary(w, r, tenantID)
	case subPath == "generate" && r.Method == http.MethodPost:
		h.generateSummary(w, r, tenantID)
	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

// listSummaries 查询历史每日摘要
func (h *DailySummaryHandler) listSummaries(w http.ResponseWriter, r *http.Request, tenantID string) {
	limit := 30
	summaries, err := h.summaryService.ListSummaries(tenantID, limit)
	if err != nil {
		http.Error(w, "Failed to list summaries: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"summaries": summaries,
	})
}

// getLatestSummary 获取最新摘要
func (h *DailySummaryHandler) getLatestSummary(w http.ResponseWriter, r *http.Request, tenantID string) {
	summary, err := h.summaryService.GetLatestSummary(tenantID)
	if err != nil {
		http.Error(w, "Failed to get latest summary: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"summary": summary,
	})
}

// generateSummary 手动触发生成摘要
func (h *DailySummaryHandler) generateSummary(w http.ResponseWriter, r *http.Request, tenantID string) {
	summary, err := h.summaryService.GenerateDailySummary(tenantID)
	if err != nil {
		http.Error(w, "Failed to generate summary: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"summary": summary,
	})
}
