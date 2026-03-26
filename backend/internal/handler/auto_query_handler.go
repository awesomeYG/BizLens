package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
)

// AutoQueryHandler AutoQuery 请求处理器
type AutoQueryHandler struct {
	autoQueryService *service.AutoQueryService
}

// NewAutoQueryHandler 创建 AutoQueryHandler
func NewAutoQueryHandler(autoQueryService *service.AutoQueryService) *AutoQueryHandler {
	return &AutoQueryHandler{autoQueryService: autoQueryService}
}

// AutoQuery POST /api/tenants/{id}/auto-query
// 根据数据源上下文自动生成并执行聚合查询，返回真实数据供 AI 生成 dashboard 使用
func (h *AutoQueryHandler) AutoQuery(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req service.AutoQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	result, err := h.autoQueryService.AutoQuery(tenantID, req)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}
