package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"ai-bi-server/internal/service"
	"github.com/google/uuid"
)

// DatasetHandler 数据集处理器
type DatasetHandler struct {
	datasetService *service.DatasetService
	uploadDir      string
}

// NewDatasetHandler 创建数据集处理器
func NewDatasetHandler(datasetService *service.DatasetService, uploadDir string) *DatasetHandler {
	return &DatasetHandler{
		datasetService: datasetService,
		uploadDir:      uploadDir,
	}
}

// UploadInit 初始化上传
// POST /api/datasets/upload/init
func (h *DatasetHandler) UploadInit(w http.ResponseWriter, r *http.Request) {
	// 获取用户信息（从上下文）
	tenantID := r.Header.Get("X-Tenant-ID")
	userID := r.Header.Get("X-User-ID")

	if tenantID == "" || userID == "" {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	var req service.UploadInitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "请求参数错误", http.StatusBadRequest)
		return
	}

	resp, err := h.datasetService.UploadInit(&req, tenantID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// UploadFile 上传文件
// POST /api/datasets/upload/file
func (h *DatasetHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	userID := r.Header.Get("X-User-ID")

	if tenantID == "" || userID == "" {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	// 限制文件大小 100MB
	r.ParseMultipartForm(100 << 20)

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "获取文件失败", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 创建上传目录
	uploadPath := filepath.Join(h.uploadDir, tenantID, uuid.New().String())
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		http.Error(w, "创建目录失败", http.StatusInternalServerError)
		return
	}

	// 创建文件
	filePath := filepath.Join(uploadPath, header.Filename)
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "创建文件失败", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// 复制文件内容
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "保存文件失败", http.StatusInternalServerError)
		return
	}

	// 完成上传
	completeReq := &service.UploadCompleteRequest{
		FileID:   "",
		FilePath: filePath,
		FileName: header.Filename,
	}

	completeResp, err := h.datasetService.UploadComplete(completeReq, tenantID, userID)
	if err != nil {
		// 清理文件
		os.Remove(filePath)
		os.Remove(uploadPath)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, completeResp)
}

// ListDatasets 列出数据集
// GET /api/datasets
func (h *DatasetHandler) ListDatasets(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	// 解析查询参数
	page := 1
	limit := 20
	search := r.URL.Query().Get("search")
	sortBy := r.URL.Query().Get("sortBy")
	order := r.URL.Query().Get("order")

	if p := r.URL.Query().Get("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	req := &service.ListDatasetsRequest{
		Page:   page,
		Limit:  limit,
		Search: search,
		SortBy: sortBy,
		Order:  order,
	}

	resp, err := h.datasetService.ListDatasets(req, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetDataset 获取数据集详情
// GET /api/datasets/:id
func (h *DatasetHandler) GetDataset(w http.ResponseWriter, r *http.Request, id string) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	dataset, err := h.datasetService.GetDataset(id, tenantID)
	if err != nil {
		http.Error(w, "数据集不存在", http.StatusNotFound)
		return
	}

	writeJSON(w, http.StatusOK, dataset)
}

// DeleteDataset 删除数据集
// DELETE /api/datasets/:id
func (h *DatasetHandler) DeleteDataset(w http.ResponseWriter, r *http.Request, id string) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	if err := h.datasetService.DeleteDataset(id, tenantID); err != nil {
		http.Error(w, "删除失败", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// GetDatasetPreview 获取数据预览
// GET /api/datasets/:id/preview
func (h *DatasetHandler) GetDatasetPreview(w http.ResponseWriter, r *http.Request, id string) {
	limit := 100
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	data, err := h.datasetService.GetDatasetPreview(id, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, data)
}

// GetQualityIssues 获取质量问题
// GET /api/datasets/:id/quality
func (h *DatasetHandler) GetQualityIssues(w http.ResponseWriter, r *http.Request, id string) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, "未授权", http.StatusUnauthorized)
		return
	}

	// TODO: 实现获取质量问题
	writeJSON(w, http.StatusOK, []interface{}{})
}
