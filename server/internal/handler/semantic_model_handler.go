package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

// SemanticModelHandler 语义模型处理器
type SemanticModelHandler struct {
	service *service.SemanticModelService
}

// NewSemanticModelHandler 创建语义模型处理器
func NewSemanticModelHandler(service *service.SemanticModelService) *SemanticModelHandler {
	return &SemanticModelHandler{service: service}
}

// BuildSemanticCache 构建语义缓存
func (h *SemanticModelHandler) BuildSemanticCache(w http.ResponseWriter, r *http.Request) {
	// POST /api/tenants/{id}/data-sources/{dsId}/semantic-model/build
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	if err := h.service.BuildSemanticCache(tenantID, dataSourceID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GetSemanticCache 获取语义缓存
func (h *SemanticModelHandler) GetSemanticCache(w http.ResponseWriter, r *http.Request) {
	// GET /api/tenants/{id}/data-sources/{dsId}/semantic-model
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	cache, err := h.service.GetSemanticCache(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cache)
}

// GetSemanticContext 获取语义上下文
func (h *SemanticModelHandler) GetSemanticContext(w http.ResponseWriter, r *http.Request) {
	// GET /api/tenants/{id}/data-sources/{dsId}/semantic-model/context
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	context, err := h.service.GetSemanticContext(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(context))
}

// RefreshSemanticCache 刷新语义缓存
func (h *SemanticModelHandler) RefreshSemanticCache(w http.ResponseWriter, r *http.Request) {
	// POST /api/tenants/{id}/data-sources/{dsId}/semantic-model/refresh
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	if err := h.service.RefreshSemanticCache(tenantID, dataSourceID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// NL2SQL 自然语言转 SQL
func (h *SemanticModelHandler) NL2SQL(w http.ResponseWriter, r *http.Request) {
	// POST /api/tenants/{id}/data-sources/{dsId}/semantic-model/nl2sql
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 5 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]
	dataSourceID := parts[2]

	var req struct {
		Query string `json:"query"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sql, err := h.service.NL2SQL(tenantID, dataSourceID, req.Query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"sql": sql})
}
