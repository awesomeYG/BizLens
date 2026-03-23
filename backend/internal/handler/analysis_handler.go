package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"time"
)

type AnalysisHandler struct {
	analysisService *service.AnalysisService
}

func NewAnalysisHandler(analysisService *service.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{analysisService: analysisService}
}

type AnalyzeQuestionRequest struct {
	Question string `json:"question"`
}

// AnalyzeQuestion POST /api/tenants/{tenantId}/analysis/query
func (h *AnalysisHandler) AnalyzeQuestion(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req AnalyzeQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}
	if req.Question == "" {
		writeError(w, http.StatusBadRequest, "question 不能为空")
		return
	}

	start := time.Now()
	packet := h.analysisService.AnalyzeQuestion(tenantID, req.Question)
	duration := time.Since(start).Milliseconds()

	if err := h.analysisService.RecordQueryLog(tenantID, req.Question, packet, duration, true); err != nil {
		writeError(w, http.StatusInternalServerError, "记录分析日志失败："+err.Error())
		return
	}

	evaluation, err := h.analysisService.GetEvaluationSummary(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取评估指标失败："+err.Error())
		return
	}
	packet.Evaluation = evaluation

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":  true,
		"analysis": packet,
	})
}

// GetAnalysisEvaluation GET /api/tenants/{tenantId}/analysis/evaluation
func (h *AnalysisHandler) GetAnalysisEvaluation(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	evaluation, err := h.analysisService.GetEvaluationSummary(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取评估指标失败："+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":    true,
		"evaluation": evaluation,
	})
}
