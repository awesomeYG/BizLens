package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
)

// DashboardTemplateHandler 大屏模板 Handler
type DashboardTemplateHandler struct {
	templateService *service.DashboardTemplateService
}

// NewDashboardTemplateHandler 创建 handler
func NewDashboardTemplateHandler(templateService *service.DashboardTemplateService) *DashboardTemplateHandler {
	return &DashboardTemplateHandler{templateService: templateService}
}

// Routes 注册路由 (需要在 main.go 中手动调用)
// 路由格式：/api/tenants/{tenantId}/dashboards/[templates|instances|sections][/{id}[/...]]
func (h *DashboardTemplateHandler) HandleTemplates(w http.ResponseWriter, r *http.Request) {
	// 解析路径：/api/tenants/{tenantId}/dashboards/templates[/{id}[/generate]]
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	// parts[0] = tenantId
	// parts[1] = dashboards
	// parts[2] = templates
	// parts[3] = templateId (optional)
	// parts[4] = action (optional, e.g., "generate")

	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]

	// GET /api/tenants/{id}/dashboards/templates - 获取模板列表
	// GET /api/tenants/{id}/dashboards/templates?category=xxx - 按分类获取
	if len(parts) == 3 && r.Method == http.MethodGet {
		h.ListTemplates(w, r, tenantID)
		return
	}

	// GET /api/tenants/{id}/dashboards/templates/system - 获取系统模板
	if len(parts) == 4 && parts[3] == "system" && r.Method == http.MethodGet {
		h.ListSystemTemplates(w, r)
		return
	}

	// GET /api/tenants/{id}/dashboards/templates/{templateId} - 获取模板详情
	if len(parts) == 4 && r.Method == http.MethodGet {
		templateID := parts[3]
		h.GetTemplate(w, r, templateID)
		return
	}

	// POST /api/tenants/{id}/dashboards/templates/{templateId}/generate - 生成实例
	if len(parts) == 5 && parts[4] == "generate" && r.Method == http.MethodPost {
		templateID := parts[3]
		h.GenerateInstance(w, r, tenantID, templateID)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *DashboardTemplateHandler) HandleInstances(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	parts := strings.Split(strings.Trim(path, "/"), "/")

	if len(parts) < 3 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	tenantID := parts[0]

	// GET /api/tenants/{id}/dashboards/instances - 获取实例列表
	if len(parts) == 3 && r.Method == http.MethodGet {
		h.ListInstances(w, r, tenantID)
		return
	}

	// POST /api/tenants/{id}/dashboards/instances - 创建实例
	if len(parts) == 3 && r.Method == http.MethodPost {
		h.CreateInstance(w, r, tenantID)
		return
	}

	// GET/PUT/DELETE /api/tenants/{id}/dashboards/instances/{instanceId}
	if len(parts) == 4 {
		instanceID := parts[3]
		switch r.Method {
		case http.MethodGet:
			h.GetInstance(w, r, tenantID, instanceID)
		case http.MethodPut:
			h.UpdateInstance(w, r, tenantID, instanceID)
		case http.MethodDelete:
			h.DeleteInstance(w, r, tenantID, instanceID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// GET /api/tenants/{id}/dashboards/instances/{instanceId}/sections
	if len(parts) == 5 && parts[4] == "sections" && r.Method == http.MethodGet {
		instanceID := parts[3]
		h.GetInstanceSections(w, r, tenantID, instanceID)
		return
	}

	// PUT/DELETE /api/tenants/{id}/dashboards/instances/{instanceId}/sections/{sectionId}
	if len(parts) == 6 && parts[4] == "sections" {
		instanceID := parts[3]
		sectionID := parts[5]
		switch r.Method {
		case http.MethodPut:
			h.UpdateSection(w, r, tenantID, instanceID, sectionID)
		case http.MethodDelete:
			h.DeleteSection(w, r, tenantID, instanceID, sectionID)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// ListTemplates 获取模板列表
func (h *DashboardTemplateHandler) ListTemplates(w http.ResponseWriter, r *http.Request, tenantID string) {
	category := r.URL.Query().Get("category")
	includeSystem, _ := strconv.ParseBool(r.URL.Query().Get("includeSystem"))

	templates, err := h.templateService.ListTemplates(tenantID, category, includeSystem)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": templates,
		"count":     len(templates),
	})
}

// ListSystemTemplates 获取系统预置模板
func (h *DashboardTemplateHandler) ListSystemTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := h.templateService.GetSystemTemplates()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": templates,
		"count":     len(templates),
	})
}

// GetTemplate 获取模板详情
func (h *DashboardTemplateHandler) GetTemplate(w http.ResponseWriter, r *http.Request, templateID string) {
	template, err := h.templateService.GetTemplate(templateID)
	if err != nil {
		http.Error(w, "模板不存在", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"template": template,
	})
}

// GenerateInstance 基于模板生成大屏实例
func (h *DashboardTemplateHandler) GenerateInstance(w http.ResponseWriter, r *http.Request, tenantID, templateID string) {
	var req struct {
		DataSourceID string `json:"dataSourceId"`
		Name         string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "请求参数错误", http.StatusBadRequest)
		return
	}

	instance, err := h.templateService.GenerateDashboardFromTemplate(
		templateID,
		tenantID,
		req.DataSourceID,
		req.Name,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"instance": instance,
	})
}

// ListInstances 获取大屏实例列表
func (h *DashboardTemplateHandler) ListInstances(w http.ResponseWriter, r *http.Request, tenantID string) {
	instances, err := h.templateService.ListDashboardInstances(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"instances": instances,
		"count":     len(instances),
	})
}

// CreateInstance 创建大屏实例
func (h *DashboardTemplateHandler) CreateInstance(w http.ResponseWriter, r *http.Request, tenantID string) {
	var req struct {
		TemplateID   string `json:"templateId"`
		DataSourceID string `json:"dataSourceId"`
		Name         string `json:"name"`
		Description  string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "请求参数错误", http.StatusBadRequest)
		return
	}

	instance := &model.DashboardInstance{
		TemplateID:      req.TemplateID,
		TenantID:        tenantID,
		DataSourceID:    req.DataSourceID,
		Name:            req.Name,
		Description:     req.Description,
		AutoRefresh:     true,
		RefreshInterval: 300,
	}

	if err := h.templateService.CreateDashboardInstance(instance); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"instance": instance,
	})
}

// GetInstance 获取大屏实例详情
func (h *DashboardTemplateHandler) GetInstance(w http.ResponseWriter, r *http.Request, tenantID, instanceID string) {
	instance, err := h.templateService.GetDashboardInstance(instanceID, tenantID)
	if err != nil {
		http.Error(w, "实例不存在", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"instance": instance,
	})
}

// UpdateInstance 更新大屏实例
func (h *DashboardTemplateHandler) UpdateInstance(w http.ResponseWriter, r *http.Request, tenantID, instanceID string) {
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "请求参数错误", http.StatusBadRequest)
		return
	}

	// 移除不允许更新的字段
	delete(updates, "id")
	delete(updates, "tenantId")
	delete(updates, "templateId")
	delete(updates, "createdAt")

	if err := h.templateService.UpdateDashboardInstance(instanceID, tenantID, updates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// DeleteInstance 删除大屏实例
func (h *DashboardTemplateHandler) DeleteInstance(w http.ResponseWriter, r *http.Request, tenantID, instanceID string) {
	if err := h.templateService.DeleteDashboardInstance(instanceID, tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// GetInstanceSections 获取实例的所有区块
func (h *DashboardTemplateHandler) GetInstanceSections(w http.ResponseWriter, r *http.Request, tenantID, instanceID string) {
	sections, err := h.templateService.GetSectionsByInstance(instanceID, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sections": sections,
		"count":    len(sections),
	})
}

// UpdateSection 更新区块
func (h *DashboardTemplateHandler) UpdateSection(w http.ResponseWriter, r *http.Request, tenantID, instanceID, sectionID string) {
	var req struct {
		Title       *string                 `json:"title,omitempty"`
		Metrics     *[]string               `json:"metrics,omitempty"`
		Dimensions  *[]string               `json:"dimensions,omitempty"`
		ChartConfig *map[string]interface{} `json:"chartConfig,omitempty"`
		Row         *int                    `json:"row,omitempty"`
		Col         *int                    `json:"col,omitempty"`
		Width       *int                    `json:"width,omitempty"`
		Height      *int                    `json:"height,omitempty"`
		Priority    *int                    `json:"priority,omitempty"`
		TimeGrain   *string                 `json:"timeGrain,omitempty"`
		TopN        *int                    `json:"topN,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "请求参数错误", http.StatusBadRequest)
		return
	}

	updates := make(map[string]interface{})
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.Metrics != nil {
		metricsJSON, _ := json.Marshal(*req.Metrics)
		updates["metrics"] = string(metricsJSON)
	}
	if req.Dimensions != nil {
		dimensionsJSON, _ := json.Marshal(*req.Dimensions)
		updates["dimensions"] = string(dimensionsJSON)
	}
	if req.ChartConfig != nil {
		chartConfigJSON, _ := json.Marshal(*req.ChartConfig)
		updates["chartConfig"] = string(chartConfigJSON)
	}
	if req.Row != nil {
		updates["row"] = *req.Row
	}
	if req.Col != nil {
		updates["col"] = *req.Col
	}
	if req.Width != nil {
		updates["width"] = *req.Width
	}
	if req.Height != nil {
		updates["height"] = *req.Height
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.TimeGrain != nil {
		updates["timeGrain"] = *req.TimeGrain
	}
	if req.TopN != nil {
		updates["topN"] = *req.TopN
	}

	if err := h.templateService.UpdateSection(sectionID, tenantID, updates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// DeleteSection 删除区块
func (h *DashboardTemplateHandler) DeleteSection(w http.ResponseWriter, r *http.Request, tenantID, instanceID, sectionID string) {
	if err := h.templateService.DeleteSection(sectionID, tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}
