package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
)

// MetricHandler 指标处理器
type MetricHandler struct {
	metricService       *service.MetricService
	dimensionService    *service.DimensionService
	relationshipService *service.RelationshipService
}

func NewMetricHandler(
	metricService *service.MetricService,
	dimensionService *service.DimensionService,
	relationshipService *service.RelationshipService,
) *MetricHandler {
	return &MetricHandler{
		metricService:       metricService,
		dimensionService:    dimensionService,
		relationshipService: relationshipService,
	}
}

// AutoDiscoverMetrics 自动发现指标
// POST /api/tenants/{id}/metrics/auto-discover
func (h *MetricHandler) AutoDiscoverMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	dataSourceID := r.URL.Query().Get("dataSourceId")

	if dataSourceID == "" {
		http.Error(w, `{"error": "dataSourceId is required"}`, http.StatusBadRequest)
		return
	}

	metrics, err := h.metricService.AutoDiscoverMetrics(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"metrics": metrics,
		"count":   len(metrics),
	})
}

// ListMetrics 获取指标列表
// GET /api/tenants/{id}/metrics
func (h *MetricHandler) ListMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	category := r.URL.Query().Get("category")
	status := r.URL.Query().Get("status")

	metrics, err := h.metricService.ListMetrics(tenantID, category, status)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"metrics": metrics,
		"count":   len(metrics),
	})
}

// CreateMetric 创建指标
// POST /api/tenants/{id}/metrics
func (h *MetricHandler) CreateMetric(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)

	var metric model.Metric
	if err := json.NewDecoder(r.Body).Decode(&metric); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	metric.TenantID = tenantID

	if err := h.metricService.CreateMetric(&metric); err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"metric": metric,
	})
}

// UpdateMetric 更新指标
// PUT /api/tenants/{id}/metrics/{metricId}
func (h *MetricHandler) UpdateMetric(w http.ResponseWriter, r *http.Request) {
	// 简单实现，从 URL 提取 metricId
	parts := strings.Split(r.URL.Path, "/")
	var metricID string
	for i, part := range parts {
		if part == "metrics" && i+1 < len(parts) {
			metricID = parts[i+1]
			break
		}
	}

	if metricID == "" {
		http.Error(w, `{"error": "metricId is required"}`, http.StatusBadRequest)
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// 确保不会更新租户 ID
	delete(updates, "tenantId")

	if err := h.metricService.UpdateMetric(metricID, updates); err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	metric, err := h.metricService.GetMetric(metricID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"metric": metric,
	})
}

// DeleteMetric 删除指标
// DELETE /api/tenants/{id}/metrics/{metricId}
func (h *MetricHandler) DeleteMetric(w http.ResponseWriter, r *http.Request) {
	// 简单实现，从 URL 提取 metricId
	parts := strings.Split(r.URL.Path, "/")
	var metricID string
	for i, part := range parts {
		if part == "metrics" && i+1 < len(parts) {
			metricID = parts[i+1]
			break
		}
	}

	if metricID == "" {
		http.Error(w, `{"error": "metricId is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.metricService.DeleteMetric(metricID); err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// GetMetric 获取单个指标
// GET /api/tenants/{id}/metrics/{metricId}
func (h *MetricHandler) GetMetric(w http.ResponseWriter, r *http.Request) {
	// 简单实现，从 URL 提取 metricId
	parts := strings.Split(r.URL.Path, "/")
	var metricID string
	for i, part := range parts {
		if part == "metrics" && i+1 < len(parts) {
			metricID = parts[i+1]
			break
		}
	}

	if metricID == "" {
		http.Error(w, `{"error": "metricId is required"}`, http.StatusBadRequest)
		return
	}

	metric, err := h.metricService.GetMetric(metricID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	tenantID := parseTenantID(r)
	// 检查租户权限
	if metric.TenantID != tenantID {
		http.Error(w, `{"error": "metric not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"metric": metric,
	})
}

// AutoDiscoverDimensions 自动发现维度
// POST /api/tenants/{id}/dimensions/auto-discover
func (h *MetricHandler) AutoDiscoverDimensions(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	dataSourceID := r.URL.Query().Get("dataSourceId")

	if dataSourceID == "" {
		http.Error(w, `{"error": "dataSourceId is required"}`, http.StatusBadRequest)
		return
	}

	dimensions, err := h.dimensionService.AutoDiscoverDimensions(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"dimensions": dimensions,
		"count":      len(dimensions),
	})
}

// AutoDiscoverRelationships 自动发现关系
// POST /api/tenants/{id}/relationships/auto-discover
func (h *MetricHandler) AutoDiscoverRelationships(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	dataSourceID := r.URL.Query().Get("dataSourceId")

	if dataSourceID == "" {
		http.Error(w, `{"error": "dataSourceId is required"}`, http.StatusBadRequest)
		return
	}

	relationships, err := h.relationshipService.AutoDiscoverRelationships(tenantID, dataSourceID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"relationships": relationships,
		"count":         len(relationships),
	})
}

// ConfirmMetrics 批量确认自动发现的指标
// POST /api/tenants/{id}/metrics/confirm
func (h *MetricHandler) ConfirmMetrics(w http.ResponseWriter, r *http.Request) {
	var request struct {
		MetricIDs []string `json:"metricIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// 批量更新状态为 active
	for _, metricID := range request.MetricIDs {
		h.metricService.UpdateMetric(metricID, map[string]interface{}{
			"status": "active",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"count":   len(request.MetricIDs),
	})
}

// SemanticSummary 获取语义层摘要
// GET /api/tenants/{id}/semantic/summary
func (h *MetricHandler) SemanticSummary(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)

	// 统计各类别数量
	metrics, _ := h.metricService.ListMetrics(tenantID, "", "")
	dimensions, _ := h.dimensionService.AutoDiscoverDimensions(tenantID, "")
	relationships, _ := h.relationshipService.AutoDiscoverRelationships(tenantID, "")

	// 按分类统计
	categoryCount := make(map[string]int)
	for _, m := range metrics {
		if m.Status == "active" {
			categoryCount[m.Category]++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"metrics": map[string]interface{}{
			"total":  len(metrics),
			"active": countByStatus(metrics, "active"),
			"draft":  countByStatus(metrics, "draft"),
		},
		"dimensions": map[string]interface{}{
			"total": len(dimensions),
		},
		"relationships": map[string]interface{}{
			"total": len(relationships),
		},
		"categories": categoryCount,
	})
}

func countByStatus(metrics []model.Metric, status string) int {
	count := 0
	for _, m := range metrics {
		if m.Status == status {
			count++
		}
	}
	return count
}
