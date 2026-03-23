package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"ai-bi-server/internal/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DatasetService 数据集服务
type DatasetService struct {
	db          *gorm.DB
	uploadDir   string
	maxFileSize int64 // 最大文件大小（字节）
}

// NewDatasetService 创建数据集服务
func NewDatasetService(db *gorm.DB, uploadDir string, maxFileSize int64) *DatasetService {
	return &DatasetService{
		db:          db,
		uploadDir:   uploadDir,
		maxFileSize: maxFileSize,
	}
}

// UploadInit 初始化上传
type UploadInitRequest struct {
	FileName    string `json:"fileName"`
	FileSize    int64  `json:"fileSize"`
	FileType    string `json:"fileType"`
	UploadMode  string `json:"uploadMode"` // single/batch
	Description string `json:"description"`
}

type UploadInitResponse struct {
	FileID    string `json:"fileId"`
	UploadURL string `json:"uploadUrl"` // 本地上传时使用文件路径
	ExpiresAt int64  `json:"expiresAt"`
}

func (s *DatasetService) UploadInit(req *UploadInitRequest, tenantID, userID string) (*UploadInitResponse, error) {
	// 检查文件大小
	if req.FileSize > s.maxFileSize {
		return nil, fmt.Errorf("文件大小超过限制 (%d MB)", s.maxFileSize/1024/1024)
	}

	// 生成文件 ID
	fileID := uuid.New().String()

	// 创建上传目录
	uploadPath := filepath.Join(s.uploadDir, tenantID, fileID)
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		return nil, fmt.Errorf("创建上传目录失败：%w", err)
	}

	return &UploadInitResponse{
		FileID:    fileID,
		UploadURL: uploadPath,
		ExpiresAt: time.Now().Add(1 * time.Hour).Unix(),
	}, nil
}

// UploadComplete 完成上传
type UploadCompleteRequest struct {
	FileID   string `json:"fileId"`
	FilePath string `json:"filePath"`
	FileName string `json:"fileName"`
}

type UploadCompleteResponse struct {
	DatasetID string `json:"datasetId"`
	TaskID    string `json:"taskId"`
	Status    string `json:"status"`
}

func (s *DatasetService) UploadComplete(req *UploadCompleteRequest, tenantID, userID string) (*UploadCompleteResponse, error) {
	// 检查文件是否存在
	if _, err := os.Stat(req.FilePath); os.IsNotExist(err) {
		return nil, errors.New("文件不存在")
	}

	// 获取文件信息
	fileInfo, err := os.Stat(req.FilePath)
	if err != nil {
		return nil, fmt.Errorf("获取文件信息失败：%w", err)
	}

	// 解析文件扩展名
	ext := strings.ToLower(filepath.Ext(req.FileName))
	fileFormat := strings.TrimPrefix(ext, ".")

	// 支持的文件格式
	supportedFormats := map[string]bool{
		"xlsx": true, "xls": true, "csv": true, "json": true, "xml": true,
	}
	if !supportedFormats[fileFormat] {
		return nil, fmt.Errorf("不支持的文件格式：%s", ext)
	}

	// 创建数据集记录
	dataset := &model.UploadedDataset{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		OwnerID:    userID,
		Name:       strings.TrimSuffix(req.FileName, ext),
		FileName:   req.FileName,
		FileSize:   fileInfo.Size(),
		FileFormat: fileFormat,
		ObjectKey:  req.FilePath,
		Status:     "uploading",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.db.Create(dataset).Error; err != nil {
		return nil, fmt.Errorf("创建数据集记录失败：%w", err)
	}

	// 异步解析文件
	go s.parseDatasetFile(dataset.ID, req.FilePath, fileFormat)

	return &UploadCompleteResponse{
		DatasetID: dataset.ID,
		TaskID:    dataset.ID,
		Status:    "uploading",
	}, nil
}

// parseDatasetFile 解析数据集文件
func (s *DatasetService) parseDatasetFile(datasetID, filePath, fileFormat string) {
	// 更新状态为解析中
	s.db.Model(&model.UploadedDataset{}).Where("id = ?", datasetID).Update("status", "parsing")

	// 调用解析器
	parser := NewFileParser()
	result, err := parser.Parse(filePath, fileFormat)

	if err != nil {
		// 解析失败
		s.db.Model(&model.UploadedDataset{}).Where("id = ?", datasetID).Updates(map[string]interface{}{
			"status": "error",
		})
		return
	}

	// 更新数据集信息
	schemaJSON, _ := json.Marshal(result.Schema)
	s.db.Model(&model.UploadedDataset{}).Where("id = ?", datasetID).Updates(map[string]interface{}{
		"rowCount":    result.RowCount,
		"columnCount": result.ColumnCount,
		"schema":      string(schemaJSON),
		"status":      "ready",
		"updated_at":  time.Now(),
	})

	// 执行数据质检
	go s.runQualityCheck(datasetID, result)
}

// GetDataset 获取数据集详情
func (s *DatasetService) GetDataset(datasetID, tenantID string) (*model.UploadedDataset, error) {
	var dataset model.UploadedDataset
	if err := s.db.Where("id = ? AND tenant_id = ?", datasetID, tenantID).First(&dataset).Error; err != nil {
		return nil, err
	}
	return &dataset, nil
}

// ListDatasets 列出数据集
type ListDatasetsRequest struct {
	Page   int    `json:"page"`
	Limit  int    `json:"limit"`
	Search string `json:"search"`
	SortBy string `json:"sortBy"`
	Order  string `json:"order"`
}

type ListDatasetsResponse struct {
	Data       []model.UploadedDataset `json:"data"`
	Total      int64                   `json:"total"`
	Page       int                     `json:"page"`
	Limit      int                     `json:"limit"`
	TotalPages int                     `json:"totalPages"`
}

func (s *DatasetService) ListDatasets(req *ListDatasetsRequest, tenantID string) (*ListDatasetsResponse, error) {
	var datasets []model.UploadedDataset
	var total int64

	query := s.db.Model(&model.UploadedDataset{}).Where("tenant_id = ?", tenantID)

	// 搜索
	if req.Search != "" {
		query = query.Where("name LIKE ? OR file_name LIKE ?", "%"+req.Search+"%", "%"+req.Search+"%")
	}

	// 总数
	query.Count(&total)

	// 排序
	sortBy := req.SortBy
	if sortBy == "" {
		sortBy = "created_at"
	}
	order := req.Order
	if order == "" {
		order = "desc"
	}
	query = query.Order(sortBy + " " + order)

	// 分页
	offset := (req.Page - 1) * req.Limit
	if offset < 0 {
		offset = 0
	}
	limit := req.Limit
	if limit <= 0 {
		limit = 20
	}
	query = query.Offset(offset).Limit(limit)

	if err := query.Find(&datasets).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	return &ListDatasetsResponse{
		Data:       datasets,
		Total:      total,
		Page:       req.Page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// DeleteDataset 删除数据集
func (s *DatasetService) DeleteDataset(datasetID, tenantID string) error {
	// 获取数据集
	dataset, err := s.GetDataset(datasetID, tenantID)
	if err != nil {
		return err
	}

	// 删除文件
	if err := os.Remove(dataset.ObjectKey); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("删除文件失败：%w", err)
	}

	// 删除记录
	return s.db.Delete(&model.UploadedDataset{}, datasetID).Error
}

// UpdateDataset 更新数据集（上传新文件）
func (s *DatasetService) UpdateDataset(datasetID, tenantID, userID, newFilePath, changeSummary string) error {
	// 获取原数据集
	dataset, err := s.GetDataset(datasetID, tenantID)
	if err != nil {
		return err
	}

	// 创建版本记录
	var maxVersion int
	s.db.Model(&model.DatasetVersion{}).Where("dataset_id = ?", datasetID).Select("MAX(version)").Scan(&maxVersion)

	version := &model.DatasetVersion{
		ID:            uuid.New().String(),
		DatasetID:     datasetID,
		Version:       maxVersion + 1,
		FileName:      dataset.FileName,
		FileSize:      dataset.FileSize,
		ObjectKey:     dataset.ObjectKey,
		RowCount:      dataset.RowCount,
		ColumnCount:   dataset.ColumnCount,
		ChangeSummary: changeSummary,
		CreatedAt:     time.Now(),
	}
	s.db.Create(version)

	// 更新数据集
	newFileInfo, err := os.Stat(newFilePath)
	if err != nil {
		return err
	}

	return s.db.Model(&model.UploadedDataset{}).Where("id = ?", datasetID).Updates(map[string]interface{}{
		"file_name":  filepath.Base(newFilePath),
		"file_size":  newFileInfo.Size(),
		"object_key": newFilePath,
		"status":     "uploading",
		"updated_at": time.Now(),
	}).Error
}

// GetDatasetPreview 获取数据预览
func (s *DatasetService) GetDatasetPreview(datasetID string, limit, offset int) (interface{}, error) {
	dataset, err := s.GetDataset(datasetID, "")
	if err != nil {
		return nil, err
	}

	// 使用解析器读取数据
	parser := NewFileParser()
	data, err := parser.Preview(dataset.ObjectKey, dataset.FileFormat, limit, offset)
	if err != nil {
		return nil, err
	}

	return data, nil
}

// runQualityCheck 执行数据质检
func (s *DatasetService) runQualityCheck(datasetID string, result *ParseResult) {
	// 创建质检规则检查器
	checker := NewQualityChecker()
	issues := checker.Check(result)

	// 保存质量问题
	for _, issue := range issues {
		qualityIssue := &model.DataQualityIssue{
			ID:            uuid.New().String(),
			DatasetID:     datasetID,
			RuleID:        issue.RuleID,
			RuleName:      issue.RuleName,
			FieldName:     issue.FieldName,
			Severity:      issue.Severity,
			Message:       issue.Message,
			Suggestion:    issue.Suggestion,
			AffectedRatio: issue.AffectedRatio,
			Status:        "open",
			CreatedAt:     time.Now(),
		}

		if issue.AffectedRows != nil {
			rowsJSON, _ := json.Marshal(issue.AffectedRows)
			qualityIssue.AffectedRows = string(rowsJSON)
		}

		s.db.Create(qualityIssue)
	}

	// 计算质量评分
	score := s.calculateQualityScore(issues)
	s.db.Model(&model.UploadedDataset{}).Where("id = ?", datasetID).Update("quality_score", score)
}

func (s *DatasetService) calculateQualityScore(issues []QualityIssue) float64 {
	score := 100.0
	for _, issue := range issues {
		switch issue.Severity {
		case "high":
			score -= 20
		case "medium":
			score -= 10
		case "low":
			score -= 5
		}
	}
	if score < 0 {
		score = 0
	}
	return score
}
