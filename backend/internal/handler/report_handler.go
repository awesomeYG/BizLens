package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

// ReportHandler 报表 HTTP 处理器
type ReportHandler struct {
	reportService *service.ReportService
}

// NewReportHandler 创建报表处理器
func NewReportHandler(reportService *service.ReportService) *ReportHandler {
	return &ReportHandler{reportService: reportService}
}

// HandleReports 统一处理 /api/tenants/{tenantId}/reports[/{reportId}[/{action}]]
func (h *ReportHandler) HandleReports(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	// 提取 tenantId 之后的部分
	// 路径格式: /api/tenants/{tenantId}/reports[/{reportId}[/{action}]]
	idx := strings.Index(path, "/reports")
	if idx == -1 {
		http.NotFound(w, r)
		return
	}

	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	sub := strings.TrimPrefix(path[idx:], "/reports")
	sub = strings.Trim(sub, "/")
	parts := strings.Split(sub, "/")

	// GET/POST /api/tenants/{id}/reports
	if sub == "" {
		switch r.Method {
		case http.MethodGet:
			h.ListReports(w, r, tenantID)
		case http.MethodPost:
			h.CreateReport(w, r, tenantID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	reportID := parts[0]

	// /api/tenants/{id}/reports/{reportId}/duplicate
	if len(parts) == 2 && parts[1] == "duplicate" && r.Method == http.MethodPost {
		h.DuplicateReport(w, r, tenantID, reportID)
		return
	}

	// GET/PUT/DELETE /api/tenants/{id}/reports/{reportId}
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			h.GetReport(w, r, tenantID, reportID)
		case http.MethodPut:
			h.UpdateReport(w, r, tenantID, reportID)
		case http.MethodDelete:
			h.DeleteReport(w, r, tenantID, reportID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.NotFound(w, r)
}

// ListReports GET /api/tenants/{id}/reports
func (h *ReportHandler) ListReports(w http.ResponseWriter, r *http.Request, tenantID string) {
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")

	reports, err := h.reportService.ListReports(tenantID, status, category)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if reports == nil {
		reports = []service.ReportDTO{}
	}
	writeJSON(w, http.StatusOK, reports)
}

// GetReport GET /api/tenants/{id}/reports/{reportId}
func (h *ReportHandler) GetReport(w http.ResponseWriter, r *http.Request, tenantID, reportID string) {
	report, err := h.reportService.GetReport(tenantID, reportID)
	if err != nil {
		writeError(w, http.StatusNotFound, "报表不存在")
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// CreateReport POST /api/tenants/{id}/reports
func (h *ReportHandler) CreateReport(w http.ResponseWriter, r *http.Request, tenantID string) {
	var req service.CreateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "报表标题不能为空")
		return
	}

	// 从 JWT context 获取 userID
	userID := ""
	if info, ok := getAuthInfoSafe(r); ok {
		userID = info.userID
	}

	report, err := h.reportService.CreateReport(tenantID, userID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, report)
}

// UpdateReport PUT /api/tenants/{id}/reports/{reportId}
func (h *ReportHandler) UpdateReport(w http.ResponseWriter, r *http.Request, tenantID, reportID string) {
	var req service.UpdateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	report, err := h.reportService.UpdateReport(tenantID, reportID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// DeleteReport DELETE /api/tenants/{id}/reports/{reportId}
func (h *ReportHandler) DeleteReport(w http.ResponseWriter, r *http.Request, tenantID, reportID string) {
	if err := h.reportService.DeleteReport(tenantID, reportID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "报表已删除"})
}

// DuplicateReport POST /api/tenants/{id}/reports/{reportId}/duplicate
func (h *ReportHandler) DuplicateReport(w http.ResponseWriter, r *http.Request, tenantID, reportID string) {
	userID := ""
	if info, ok := getAuthInfoSafe(r); ok {
		userID = info.userID
	}

	report, err := h.reportService.DuplicateReport(tenantID, reportID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, report)
}

// authInfoResult 认证信息
type authInfoResult struct {
	tenantID string
	userID   string
}

// getAuthInfoSafe 安全获取认证信息
func getAuthInfoSafe(r *http.Request) (authInfoResult, bool) {
	tenantID, _ := r.Context().Value("tenantID").(string)
	userID, _ := r.Context().Value("userID").(string)
	if tenantID == "" && userID == "" {
		return authInfoResult{}, false
	}
	return authInfoResult{tenantID: tenantID, userID: userID}, true
}
