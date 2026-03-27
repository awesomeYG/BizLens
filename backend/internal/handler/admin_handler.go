package handler

import (
	"ai-bi-server/internal/dto"
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type AdminHandler struct {
	authService       *service.AuthService
	dataSourceService *service.DataSourceService
	datasetService    *service.DatasetService
}

func NewAdminHandler(
	authService *service.AuthService,
	dataSourceService *service.DataSourceService,
	datasetService *service.DatasetService,
) *AdminHandler {
	return &AdminHandler{
		authService:       authService,
		dataSourceService: dataSourceService,
		datasetService:    datasetService,
	}
}

// getUserIDFromCtx 获取当前用户 ID
func getUserIDFromCtx(r *http.Request) string {
	if v := r.Context().Value("userID"); v != nil {
		return v.(string)
	}
	return ""
}

// writeJSONAdmin 统一 JSON 响应
func writeJSONAdmin(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeErrorAdmin 统一错误响应
func writeErrorAdmin(w http.ResponseWriter, status int, msg string) {
	writeJSONAdmin(w, status, map[string]string{"error": msg})
}

// ============================================================
// 系统统计
// GET /api/admin/stats
// ============================================================
func (h *AdminHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	db := h.authService.DB()

	// 统计用户数
	var totalUsers int64
	db.Model(&model.User{}).Where("deleted_at IS NULL").Count(&totalUsers)

	// 统计文件数
	var totalDatasets int64
	db.Model(&model.UploadedDataset{}).Where("deleted_at IS NULL").Count(&totalDatasets)

	// 统计数据源数
	var totalDataSources int64
	db.Model(&model.DataSource{}).Where("deleted_at IS NULL").Count(&totalDataSources)

	// 统计存储总量
	var totalStorageSize int64
	db.Model(&model.UploadedDataset{}).Where("deleted_at IS NULL").
		Select("COALESCE(SUM(file_size), 0)").Scan(&totalStorageSize)

	// 按格式统计存储
	type FormatStat struct {
		Format string `gorm:"column:file_format"`
		Total  int64  `gorm:"column:total"`
	}
	var formatStats []FormatStat
	db.Model(&model.UploadedDataset{}).
		Select("file_format, COALESCE(SUM(file_size), 0) as total").
		Where("deleted_at IS NULL").
		Group("file_format").
		Scan(&formatStats)

	storageByFormat := make(map[string]int64)
	for _, fs := range formatStats {
		storageByFormat[fs.Format] = fs.Total
	}

	// 最近上传的文件（5条）
	var recentDatasets []model.UploadedDataset
	db.Model(&model.UploadedDataset{}).
		Where("deleted_at IS NULL").
		Order("created_at DESC").
		Limit(5).
		Find(&recentDatasets)

	type DatasetSummary struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		FileName   string `json:"fileName"`
		FileSize   int64  `json:"fileSize"`
		FileFormat string `json:"fileFormat"`
		CreatedAt  string `json:"createdAt"`
	}
	recent := make([]DatasetSummary, len(recentDatasets))
	for i, d := range recentDatasets {
		recent[i] = DatasetSummary{
			ID:         d.ID,
			Name:       d.Name,
			FileName:   d.FileName,
			FileSize:   d.FileSize,
			FileFormat: d.FileFormat,
			CreatedAt:  d.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
		"totalUsers":       totalUsers,
		"totalDatasets":    totalDatasets,
		"totalDataSources": totalDataSources,
		"totalStorageSize": totalStorageSize,
		"storageByFormat":  storageByFormat,
		"recentDatasets":   recent,
	})
}

// ============================================================
// 用户管理
// ============================================================

// ListUsers GET /api/admin/users
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	keyword := r.URL.Query().Get("keyword")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	users, total, err := h.authService.ListUsers(tenantID, keyword, page, pageSize)
	if err != nil {
		writeErrorAdmin(w, http.StatusInternalServerError, err.Error())
		return
	}

	type UserItem struct {
		ID          string `json:"id"`
		TenantID    string `json:"tenantId"`
		Name        string `json:"name"`
		Email       string `json:"email"`
		Role        string `json:"role"`
		LastLoginAt string `json:"lastLoginAt,omitempty"`
		CreatedAt   string `json:"createdAt"`
		IsLocked    bool   `json:"isLocked"`
	}
	items := make([]UserItem, len(users))
	for i, u := range users {
		items[i] = UserItem{
			ID:        u.ID,
			TenantID:  u.TenantID,
			Name:      u.Name,
			Email:     u.Email,
			Role:      u.Role,
			CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05Z"),
			IsLocked:  u.LockedUntil != nil,
		}
		if u.LastLoginAt != nil {
			items[i].LastLoginAt = u.LastLoginAt.Format("2006-01-02T15:04:05Z")
		}
	}

	writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
		"users":     items,
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
		"totalPage": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// CreateUser POST /api/admin/users
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, "请求体解析失败")
		return
	}
	if req.Name == "" || req.Email == "" || req.Password == "" || req.Role == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "name, email, password, role 必填")
		return
	}
	if req.Role != "admin" && req.Role != "member" {
		writeErrorAdmin(w, http.StatusBadRequest, "role 只能为 admin 或 member")
		return
	}

	user, err := h.authService.CreateUser(&req)
	if err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONAdmin(w, http.StatusCreated, map[string]interface{}{
		"id":        user.ID,
		"tenantId":  user.TenantID,
		"name":      user.Name,
		"email":     user.Email,
		"role":      user.Role,
		"createdAt": user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

// UpdateUser PUT /api/admin/users/{id}
func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := extractLastPathPart(r.URL.Path)
	if userID == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	// 检查是否是 owner
	var existing model.User
	if err := h.authService.DB().Where("id = ?", userID).First(&existing).Error; err != nil {
		writeErrorAdmin(w, http.StatusNotFound, "用户不存在")
		return
	}
	if existing.Role == "owner" {
		writeErrorAdmin(w, http.StatusBadRequest, "无法修改 owner 角色的用户")
		return
	}

	var req struct {
		Name string `json:"name"`
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if err := h.authService.AdminUpdateUser(userID, req.Name, req.Role); err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONAdmin(w, http.StatusOK, map[string]string{"message": "更新成功"})
}

// DeleteUser DELETE /api/admin/users/{id}
func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := extractLastPathPart(r.URL.Path)
	if userID == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	// 不能删除自己
	if userID == getUserIDFromCtx(r) {
		writeErrorAdmin(w, http.StatusBadRequest, "无法删除自己的账号")
		return
	}

	// 检查是否是 owner
	var existing model.User
	if err := h.authService.DB().Where("id = ?", userID).First(&existing).Error; err != nil {
		writeErrorAdmin(w, http.StatusNotFound, "用户不存在")
		return
	}
	if existing.Role == "owner" {
		writeErrorAdmin(w, http.StatusBadRequest, "无法删除 owner 角色的用户")
		return
	}

	if err := h.authService.DeleteUser(userID); err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONAdmin(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// ResetUserPassword POST /api/admin/users/{id}/reset-password
func (h *AdminHandler) ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	userID := extractLastPathPart(r.URL.Path)
	if userID == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	newPassword, err := h.authService.ResetUserPassword(userID)
	if err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSONAdmin(w, http.StatusOK, map[string]string{
		"password": newPassword,
		"message":  "密码已重置，请将新密码告知用户（仅显示一次）",
	})
}

// ToggleUserStatus POST /api/admin/users/{id}/toggle
func (h *AdminHandler) ToggleUserStatus(w http.ResponseWriter, r *http.Request) {
	userID := extractLastPathPart(r.URL.Path)
	if userID == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	// 不能操作自己
	if userID == getUserIDFromCtx(r) {
		writeErrorAdmin(w, http.StatusBadRequest, "无法操作自己的账号")
		return
	}

	// 检查是否是 owner
	var existing model.User
	if err := h.authService.DB().Where("id = ?", userID).First(&existing).Error; err != nil {
		writeErrorAdmin(w, http.StatusNotFound, "用户不存在")
		return
	}
	if existing.Role == "owner" {
		writeErrorAdmin(w, http.StatusBadRequest, "无法操作 owner 角色的用户")
		return
	}

	_, enabled, err := h.authService.ToggleUserStatus(userID)
	if err != nil {
		writeErrorAdmin(w, http.StatusBadRequest, err.Error())
		return
	}

	action := "已启用"
	if !enabled {
		action = "已禁用"
	}
	writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
		"message": action,
		"enabled": enabled,
	})
}

// ============================================================
// 数据资产
// ============================================================

// ListAllDatasets GET /api/admin/datasets
func (h *AdminHandler) ListAllDatasets(w http.ResponseWriter, r *http.Request) {
	fileFormat := r.URL.Query().Get("format")
	keyword := r.URL.Query().Get("keyword")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	db := h.authService.DB()
	query := db.Model(&model.UploadedDataset{}).Where("deleted_at IS NULL")
	if fileFormat != "" {
		query = query.Where("file_format = ?", fileFormat)
	}
	if keyword != "" {
		query = query.Where("name LIKE ? OR file_name LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	var total int64
	query.Count(&total)

	var datasets []model.UploadedDataset
	offset := (page - 1) * pageSize
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&datasets)

	type DatasetItem struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		FileName   string `json:"fileName"`
		FileSize   int64  `json:"fileSize"`
		FileFormat string `json:"fileFormat"`
		RowCount   int    `json:"rowCount"`
		Status     string `json:"status"`
		CreatedAt  string `json:"createdAt"`
	}
	items := make([]DatasetItem, len(datasets))
	for i, d := range datasets {
		items[i] = DatasetItem{
			ID:         d.ID,
			Name:       d.Name,
			FileName:   d.FileName,
			FileSize:   d.FileSize,
			FileFormat: d.FileFormat,
			RowCount:   d.RowCount,
			Status:     d.Status,
			CreatedAt:  d.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}

	writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
		"datasets":  items,
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
		"totalPage": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// DeleteDataset DELETE /api/admin/datasets/{id}
func (h *AdminHandler) DeleteDataset(w http.ResponseWriter, r *http.Request) {
	id := extractLastPathPart(r.URL.Path)
	if id == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	// 直接通过 GORM 删除（绕过租户限制）
	db := h.authService.DB()
	var ds model.UploadedDataset
	if err := db.Where("id = ?", id).First(&ds).Error; err != nil {
		writeErrorAdmin(w, http.StatusNotFound, "文件不存在")
		return
	}

	if err := db.Delete(&ds).Error; err != nil {
		writeErrorAdmin(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONAdmin(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// ListAllDataSources GET /api/admin/data-sources
func (h *AdminHandler) ListAllDataSources(w http.ResponseWriter, r *http.Request) {
	dbType := r.URL.Query().Get("type")
	keyword := r.URL.Query().Get("keyword")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	db := h.authService.DB()
	query := db.Model(&model.DataSource{}).Where("deleted_at IS NULL")
	if dbType != "" {
		query = query.Where("type = ?", dbType)
	}
	if keyword != "" {
		query = query.Where("name LIKE ? OR host LIKE ? OR database LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	var total int64
	query.Count(&total)

	var dataSources []model.DataSource
	offset := (page - 1) * pageSize
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&dataSources)

	type DataSourceItem struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		Type       string `json:"type"`
		Host       string `json:"host,omitempty"`
		Port       int    `json:"port,omitempty"`
		Database   string `json:"database,omitempty"`
		Status     string `json:"status"`
		LastSyncAt string `json:"lastSyncAt,omitempty"`
		CreatedAt  string `json:"createdAt"`
	}
	items := make([]DataSourceItem, len(dataSources))
	for i, ds := range dataSources {
		items[i] = DataSourceItem{
			ID:        ds.ID,
			Name:      ds.Name,
			Type:      string(ds.Type),
			Host:      ds.Host,
			Port:      ds.Port,
			Database:  ds.Database,
			Status:    string(ds.Status),
			CreatedAt: ds.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
		if ds.LastSyncAt != nil {
			items[i].LastSyncAt = ds.LastSyncAt.Format("2006-01-02T15:04:05Z")
		}
	}

	writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
		"dataSources": items,
		"total":       total,
		"page":        page,
		"pageSize":    pageSize,
		"totalPage":   (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

// TestDataSource POST /api/admin/data-sources/{id}/test
func (h *AdminHandler) TestDataSource(w http.ResponseWriter, r *http.Request) {
	id := extractLastPathPart(r.URL.Path)
	if id == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	ds, err := h.dataSourceService.GetDataSource(id, "")
	if err != nil {
		writeErrorAdmin(w, http.StatusNotFound, "数据源不存在")
		return
	}

	err = h.dataSourceService.TestConnection(ds)
	if err != nil {
		writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	writeJSONAdmin(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "连接成功",
	})
}

// DeleteDataSource DELETE /api/admin/data-sources/{id}
func (h *AdminHandler) DeleteDataSource(w http.ResponseWriter, r *http.Request) {
	id := extractLastPathPart(r.URL.Path)
	if id == "" {
		writeErrorAdmin(w, http.StatusBadRequest, "无效的路径")
		return
	}

	if err := h.dataSourceService.DeleteDataSource(id, ""); err != nil {
		writeErrorAdmin(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSONAdmin(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// extractLastPathPart 从 /api/admin/users/{id} 提取 {id}
func extractLastPathPart(path string) string {
	// 去掉前缀 /api/admin/
	path = strings.TrimPrefix(path, "/api/admin/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 1 {
		return ""
	}
	return parts[len(parts)-1]
}
