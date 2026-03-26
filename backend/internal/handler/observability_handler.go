package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"

	"gorm.io/gorm"
)

// ObservabilityHandler 观测中心统一 API 处理器
type ObservabilityHandler struct {
	db                  *gorm.DB
	anomalyService      *service.AnomalyService
	dailySummaryService *service.DailySummaryService
	baselineService     *service.BaselineService
	rcaService          *service.RCAService
}

// NewObservabilityHandler 创建观测中心 Handler
func NewObservabilityHandler(
	db *gorm.DB,
	anomalyService *service.AnomalyService,
	dailySummaryService *service.DailySummaryService,
	baselineService *service.BaselineService,
	rcaService *service.RCAService,
) *ObservabilityHandler {
	return &ObservabilityHandler{
		db:                  db,
		anomalyService:      anomalyService,
		dailySummaryService: dailySummaryService,
		baselineService:     baselineService,
		rcaService:          rcaService,
	}
}

// HandleObservability 统一入口路由
// GET  /api/tenants/{tenantId}/observability/health-score
// GET  /api/tenants/{tenantId}/observability/core-metrics
// GET  /api/tenants/{tenantId}/observability/anomalies
// GET  /api/tenants/{tenantId}/observability/anomalies/{id}
// PUT  /api/tenants/{tenantId}/observability/anomalies/{id}/acknowledge
// PUT  /api/tenants/{tenantId}/observability/anomalies/{id}/resolve
// PUT  /api/tenants/{tenantId}/observability/anomalies/{id}/false-positive
// GET  /api/tenants/{tenantId}/observability/insights
// GET  /api/tenants/{tenantId}/observability/summaries
// GET  /api/tenants/{tenantId}/observability/summaries/latest
// POST /api/tenants/{tenantId}/observability/summaries/generate
// POST /api/tenants/{tenantId}/observability/rca/analyze
func (h *ObservabilityHandler) HandleObservability(w http.ResponseWriter, r *http.Request) {
	// 从路径提取 tenantId: /api/tenants/{tenantId}/observability/...
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	tenantID := parts[2]
	// parts[3] = "observability"
	subPath := ""
	if len(parts) >= 5 {
		subPath = parts[4]
	}
	subPath2 := ""
	if len(parts) >= 6 {
		subPath2 = parts[5]
	}
	subPath3 := ""
	if len(parts) >= 7 {
		subPath3 = parts[6]
	}

	switch {
	// GET /observability/health-score
	case subPath == "health-score" && r.Method == http.MethodGet:
		h.getHealthScore(w, r, tenantID)

	// GET /observability/core-metrics
	case subPath == "core-metrics" && r.Method == http.MethodGet:
		h.getCoreMetrics(w, r, tenantID)

	// GET /observability/anomalies
	case subPath == "anomalies" && subPath2 == "" && r.Method == http.MethodGet:
		h.listAnomalies(w, r, tenantID)

	// PUT /observability/anomalies/{id}/acknowledge
	case subPath == "anomalies" && subPath3 == "acknowledge" && r.Method == http.MethodPut:
		h.updateAnomalyStatus(w, r, tenantID, subPath2, model.AnomalyAcknowledged)

	// PUT /observability/anomalies/{id}/resolve
	case subPath == "anomalies" && subPath3 == "resolve" && r.Method == http.MethodPut:
		h.updateAnomalyStatus(w, r, tenantID, subPath2, model.AnomalyResolved)

	// PUT /observability/anomalies/{id}/false-positive
	case subPath == "anomalies" && subPath3 == "false-positive" && r.Method == http.MethodPut:
		h.updateAnomalyStatus(w, r, tenantID, subPath2, model.AnomalyFalsePositive)

	// GET /observability/anomalies/{id}  (单条详情)
	case subPath == "anomalies" && subPath2 != "" && subPath3 == "" && r.Method == http.MethodGet:
		h.getAnomalyDetail(w, r, tenantID, subPath2)

	// GET /observability/insights
	case subPath == "insights" && r.Method == http.MethodGet:
		h.getInsights(w, r, tenantID)

	// GET /observability/summaries
	case subPath == "summaries" && subPath2 == "" && r.Method == http.MethodGet:
		h.listSummaries(w, r, tenantID)

	// GET /observability/summaries/latest
	case subPath == "summaries" && subPath2 == "latest" && r.Method == http.MethodGet:
		h.getLatestSummary(w, r, tenantID)

	// POST /observability/summaries/generate
	case subPath == "summaries" && subPath2 == "generate" && r.Method == http.MethodPost:
		h.generateSummary(w, r, tenantID)

	// POST /observability/rca/analyze
	case subPath == "rca" && subPath2 == "analyze" && r.Method == http.MethodPost:
		h.analyzeRootCause(w, r, tenantID)

	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

// getHealthScore 获取健康评分 + 趋势
func (h *ObservabilityHandler) getHealthScore(w http.ResponseWriter, r *http.Request, tenantID string) {
	// 生成当日摘要以获取健康评分
	summary, err := h.dailySummaryService.GenerateDailySummary(tenantID)
	if err != nil {
		// 可能是无数据源或无指标，返回默认状态
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"score":   0,
				"delta":   0,
				"level":   "unknown",
				"trend":   []interface{}{},
				"message": err.Error(),
			},
		})
		return
	}

	// 获取历史摘要用于趋势
	summaries, _ := h.dailySummaryService.ListSummaries(tenantID, 7)
	trend := make([]map[string]interface{}, 0, len(summaries))
	for _, s := range summaries {
		trend = append(trend, map[string]interface{}{
			"date":  s.SummaryDate,
			"score": s.HealthScore,
		})
	}

	// 计算较昨日变化
	delta := 0
	if len(summaries) >= 2 {
		delta = summary.HealthScore - summaries[1].HealthScore
	}

	// 等级映射
	level := "excellent"
	score := summary.HealthScore
	switch {
	case score >= 90:
		level = "excellent"
	case score >= 75:
		level = "good"
	case score >= 60:
		level = "attention"
	case score >= 40:
		level = "warning"
	default:
		level = "danger"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"score": score,
			"delta": delta,
			"level": level,
			"trend": trend,
		},
	})
}

// getCoreMetrics 获取核心指标速览
func (h *ObservabilityHandler) getCoreMetrics(w http.ResponseWriter, r *http.Request, tenantID string) {
	// 复用 DailySummaryService 的指标查询能力
	summary, err := h.dailySummaryService.GenerateDailySummary(tenantID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"metrics": []interface{}{},
				"message": err.Error(),
			},
		})
		return
	}

	// 解析摘要内容获取指标数据
	var content service.SummaryContent
	if err := json.Unmarshal([]byte(summary.Content), &content); err != nil {
		http.Error(w, "Failed to parse summary content", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"metrics":     content.Metrics,
			"predictions": content.Predictions,
			"topChanges":  content.TopChanges,
		},
	})
}

// listAnomalies 获取异常事件列表
func (h *ObservabilityHandler) listAnomalies(w http.ResponseWriter, r *http.Request, tenantID string) {
	status := r.URL.Query().Get("status")
	anomalyStatus := model.AnomalyStatus(status)

	anomalies, err := h.anomalyService.ListAnomalies(tenantID, anomalyStatus, 50)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"anomalies": anomalies,
		"total":     len(anomalies),
	})
}

// getAnomalyDetail 获取单条异常详情
func (h *ObservabilityHandler) getAnomalyDetail(w http.ResponseWriter, r *http.Request, tenantID, anomalyID string) {
	anomalies, err := h.anomalyService.ListAnomalies(tenantID, "", 100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for _, a := range anomalies {
		if a.ID == anomalyID {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"anomaly": a,
			})
			return
		}
	}

	http.Error(w, "Anomaly not found", http.StatusNotFound)
}

// updateAnomalyStatus 更新异常状态
func (h *ObservabilityHandler) updateAnomalyStatus(w http.ResponseWriter, r *http.Request, tenantID, anomalyID string, status model.AnomalyStatus) {
	// 直接通过 DB 更新（通过 anomalyService 的 db 引用）
	// 这里简化处理，通过检测服务的底层方法更新
	var anomaly model.AnomalyEvent
	if err := h.db.
		Where("id = ? AND tenant_id = ?", anomalyID, tenantID).
		First(&anomaly).Error; err != nil {
		http.Error(w, "Anomaly not found", http.StatusNotFound)
		return
	}

	anomaly.Status = status
	if err := h.db.Save(&anomaly).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"anomaly": anomaly,
	})
}

// getInsights 获取 AI 洞察
func (h *ObservabilityHandler) getInsights(w http.ResponseWriter, r *http.Request, tenantID string) {
	summary, err := h.dailySummaryService.GenerateDailySummary(tenantID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"insights": []interface{}{},
		})
		return
	}

	var content service.SummaryContent
	if err := json.Unmarshal([]byte(summary.Content), &content); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"insights": []interface{}{},
		})
		return
	}

	// 将 concerns, positives, trends 转换为洞察列表
	insights := make([]map[string]interface{}, 0)

	for _, c := range content.Concerns {
		insights = append(insights, map[string]interface{}{
			"type":        "negative",
			"title":       c.MetricName + " 需要关注",
			"description": c.Analysis,
			"metricName":  c.MetricName,
			"severity":    c.Severity,
			"confidence":  0.85,
		})
	}

	for _, p := range content.Positives {
		insights = append(insights, map[string]interface{}{
			"type":        "positive",
			"title":       p.MetricName + " 表现良好",
			"description": p.Reason,
			"metricName":  p.MetricName,
			"confidence":  0.8,
		})
	}

	for _, t := range content.Trends {
		insights = append(insights, map[string]interface{}{
			"type":        "neutral",
			"title":       "趋势概要",
			"description": t,
			"confidence":  0.7,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"insights": insights,
	})
}

// listSummaries 获取摘要历史
func (h *ObservabilityHandler) listSummaries(w http.ResponseWriter, r *http.Request, tenantID string) {
	summaries, err := h.dailySummaryService.ListSummaries(tenantID, 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"summaries": summaries,
	})
}

// getLatestSummary 获取最新摘要
func (h *ObservabilityHandler) getLatestSummary(w http.ResponseWriter, r *http.Request, tenantID string) {
	summary, err := h.dailySummaryService.GetLatestSummary(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"summary": summary,
	})
}

// generateSummary 手动触发生成摘要
func (h *ObservabilityHandler) generateSummary(w http.ResponseWriter, r *http.Request, tenantID string) {
	summary, err := h.dailySummaryService.GenerateDailySummary(tenantID)
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

// analyzeRootCause 执行根因分析
func (h *ObservabilityHandler) analyzeRootCause(w http.ResponseWriter, r *http.Request, tenantID string) {
	var req service.RCARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	req.TenantID = tenantID

	if req.MetricID == "" {
		http.Error(w, "metricId is required", http.StatusBadRequest)
		return
	}

	result, err := h.rcaService.Analyze(req)
	if err != nil {
		http.Error(w, "RCA analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"result":  result,
	})
}
