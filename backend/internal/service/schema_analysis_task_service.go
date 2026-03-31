package service

import (
	"ai-bi-server/internal/model"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type SchemaAnalysisTaskService struct {
	db                *gorm.DB
	dataSourceService *DataSourceService
	schemaAnalysisSvc *SchemaAnalysisService
}

func NewSchemaAnalysisTaskService(db *gorm.DB, dataSourceService *DataSourceService, schemaAnalysisSvc *SchemaAnalysisService) *SchemaAnalysisTaskService {
	return &SchemaAnalysisTaskService{
		db:                db,
		dataSourceService: dataSourceService,
		schemaAnalysisSvc: schemaAnalysisSvc,
	}
}

func normalizeAnalyzeMode(mode string) string {
	if mode == "full" {
		return "full"
	}
	return "incremental"
}

func (s *SchemaAnalysisTaskService) StartTask(tenantID, dataSourceID, mode string) (*model.SchemaAnalysisTask, bool, error) {
	mode = normalizeAnalyzeMode(mode)

	var existing model.SchemaAnalysisTask
	err := s.db.
		Where("tenant_id = ? AND data_source_id = ? AND status IN ?", tenantID, dataSourceID, []model.SchemaAnalysisTaskStatus{model.SchemaAnalysisTaskPending, model.SchemaAnalysisTaskRunning}).
		Order("created_at DESC").
		First(&existing).Error
	if err == nil {
		return &existing, true, nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	task := &model.SchemaAnalysisTask{
		TenantID:     tenantID,
		DataSourceID: dataSourceID,
		Mode:         mode,
		Status:       model.SchemaAnalysisTaskPending,
	}
	if err := s.db.Create(task).Error; err != nil {
		return nil, false, err
	}

	go s.runTask(task.ID)

	return task, false, nil
}

func (s *SchemaAnalysisTaskService) GetTask(tenantID, dataSourceID, taskID string) (*model.SchemaAnalysisTask, error) {
	var task model.SchemaAnalysisTask
	err := s.db.Where("id = ? AND tenant_id = ? AND data_source_id = ?", taskID, tenantID, dataSourceID).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (s *SchemaAnalysisTaskService) GetLatestTask(tenantID, dataSourceID string) (*model.SchemaAnalysisTask, error) {
	var task model.SchemaAnalysisTask
	err := s.db.Where("tenant_id = ? AND data_source_id = ?", tenantID, dataSourceID).Order("created_at DESC").First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (s *SchemaAnalysisTaskService) DeserializeDiff(task *model.SchemaAnalysisTask) (*SchemaDiff, error) {
	if task == nil || task.DiffJSON == "" {
		return nil, nil
	}
	var diff SchemaDiff
	if err := json.Unmarshal([]byte(task.DiffJSON), &diff); err != nil {
		return nil, err
	}
	return &diff, nil
}

func (s *SchemaAnalysisTaskService) runTask(taskID string) {
	now := time.Now()
	if err := s.db.Model(&model.SchemaAnalysisTask{}).
		Where("id = ?", taskID).
		Updates(map[string]interface{}{"status": model.SchemaAnalysisTaskRunning, "started_at": &now, "error_message": ""}).Error; err != nil {
		return
	}

	task := &model.SchemaAnalysisTask{}
	if err := s.db.First(task, "id = ?", taskID).Error; err != nil {
		return
	}

	ds, err := s.dataSourceService.GetDataSource(task.DataSourceID, task.TenantID)
	if err != nil {
		s.failTask(taskID, fmt.Sprintf("加载数据源失败: %v", err), nil)
		return
	}
	if ds.SchemaInfo == "" {
		s.failTask(taskID, "请先同步数据库 schema", nil)
		return
	}

	var analysis *model.SchemaAIAnalysis
	var diff *SchemaDiff

	if task.Mode == "full" {
		analysis, err = s.schemaAnalysisSvc.AnalyzeSchema(task.TenantID, ds)
	} else {
		oldAnalysis, _ := DeserializeAIAnalysis(ds.AIAnalysis)
		analysis, diff, err = s.schemaAnalysisSvc.IncrementalAnalyzeSchema(task.TenantID, ds, oldAnalysis)
	}
	if err != nil {
		s.failTask(taskID, humanizeAnalyzeError(err), diff)
		return
	}

	analysisJSON, err := SerializeAIAnalysis(analysis)
	if err != nil {
		s.failTask(taskID, "保存分析结果失败", diff)
		return
	}

	if err := s.db.Model(&model.DataSource{}).
		Where("id = ? AND tenant_id = ?", ds.ID, task.TenantID).
		Update("ai_analysis", analysisJSON).Error; err != nil {
		s.failTask(taskID, "更新数据源失败", diff)
		return
	}

	completedAt := time.Now()
	updates := map[string]interface{}{
		"status":        model.SchemaAnalysisTaskSucceeded,
		"completed_at":  &completedAt,
		"error_message": "",
		"diff_json":     mustMarshalDiff(diff),
	}
	_ = s.db.Model(&model.SchemaAnalysisTask{}).Where("id = ?", taskID).Updates(updates).Error
}

func (s *SchemaAnalysisTaskService) failTask(taskID, message string, diff *SchemaDiff) {
	completedAt := time.Now()
	updates := map[string]interface{}{
		"status":        model.SchemaAnalysisTaskFailed,
		"completed_at":  &completedAt,
		"error_message": message,
		"diff_json":     mustMarshalDiff(diff),
	}
	_ = s.db.Model(&model.SchemaAnalysisTask{}).Where("id = ?", taskID).Updates(updates).Error
}

func mustMarshalDiff(diff *SchemaDiff) string {
	if diff == nil {
		return ""
	}
	b, err := json.Marshal(diff)
	if err != nil {
		return ""
	}
	return string(b)
}

func humanizeAnalyzeError(err error) string {
	if errors.Is(err, ErrAIConfigMissingAPIKey) {
		return "AI 分析失败：未配置 API Key，请先完成 AI 设置"
	}
	return fmt.Sprintf("AI 分析失败：%v", err)
}
