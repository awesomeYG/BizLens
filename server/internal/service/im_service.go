package service

import (
	"ai-bi-server/internal/im"
	"ai-bi-server/internal/model"
	"errors"
	"time"

	"gorm.io/gorm"
)

type IMService struct {
	db *gorm.DB
}

func NewIMService(db *gorm.DB) *IMService {
	return &IMService{db: db}
}

// ListConfigs 获取租户下所有 IM 配置
func (s *IMService) ListConfigs(tenantID string) ([]model.IMConfig, error) {
	var configs []model.IMConfig
	err := s.db.Where("tenant_id = ?", tenantID).Order("created_at DESC").Find(&configs).Error
	return configs, err
}

// GetConfig 获取单个配置
func (s *IMService) GetConfig(tenantID, id string) (*model.IMConfig, error) {
	var cfg model.IMConfig
	err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&cfg).Error
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// CreateConfig 创建 IM 配置
func (s *IMService) CreateConfig(tenantID string, cfg *model.IMConfig) error {
	cfg.TenantID = tenantID
	cfg.Status = model.IMStatusDisconnected
	return s.db.Create(cfg).Error
}

// UpdateConfig 更新 IM 配置
func (s *IMService) UpdateConfig(tenantID, id string, updates map[string]interface{}) (*model.IMConfig, error) {
	var cfg model.IMConfig
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&cfg).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&cfg).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &cfg, nil
}

// DeleteConfig 删除 IM 配置（软删除）
func (s *IMService) DeleteConfig(tenantID, id string) error {
	result := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&model.IMConfig{})
	if result.RowsAffected == 0 {
		return errors.New("配置不存在")
	}
	return result.Error
}

// TestConnection 测试 IM 连接
func (s *IMService) TestConnection(tenantID, id string) (*im.SendResult, error) {
	cfg, err := s.GetConfig(tenantID, id)
	if err != nil {
		return nil, err
	}

	adapter := im.GetAdapter(cfg.Type)
	if adapter == nil {
		return nil, errors.New("不支持的平台类型")
	}

	result := adapter.Test(cfg.WebhookURL, cfg.Secret)

	// 更新连接状态
	status := model.IMStatusConnected
	if !result.Success {
		status = model.IMStatusError
	}
	s.db.Model(cfg).Update("status", status)

	return &result, nil
}

// SendNotification 发送通知
func (s *IMService) SendNotification(tenantID string, platformIDs []string, templateType, title, content string, markdown bool) ([]model.NotificationRecord, error) {
	var records []model.NotificationRecord

	for _, pid := range platformIDs {
		cfg, err := s.GetConfig(tenantID, pid)
		if err != nil {
			records = append(records, model.NotificationRecord{
				TenantID:     tenantID,
				PlatformID:   pid,
				TemplateType: templateType,
				Title:        title,
				Content:      content,
				Markdown:     markdown,
				Status:       model.NotifyFailed,
				Error:        "配置不存在",
			})
			continue
		}

		if !cfg.Enabled {
			records = append(records, model.NotificationRecord{
				TenantID:     tenantID,
				PlatformID:   pid,
				PlatformType: cfg.Type,
				TemplateType: templateType,
				Title:        title,
				Content:      content,
				Markdown:     markdown,
				Status:       model.NotifyFailed,
				Error:        "该平台已禁用",
			})
			continue
		}

		adapter := im.GetAdapter(cfg.Type)
		if adapter == nil {
			continue
		}

		result := adapter.Send(cfg.WebhookURL, im.Message{
			Title:    title,
			Content:  content,
			Markdown: markdown,
		}, cfg.Secret)

		now := time.Now()
		record := model.NotificationRecord{
			TenantID:     tenantID,
			PlatformID:   pid,
			PlatformType: cfg.Type,
			TemplateType: templateType,
			Title:        title,
			Content:      content,
			Markdown:     markdown,
		}

		if result.Success {
			record.Status = model.NotifySent
			record.SentAt = &now
		} else {
			record.Status = model.NotifyFailed
			record.Error = result.Error
		}

		s.db.Create(&record)
		records = append(records, record)
	}

	return records, nil
}

// ListNotifications 获取通知历史
func (s *IMService) ListNotifications(tenantID string, limit int) ([]model.NotificationRecord, error) {
	var records []model.NotificationRecord
	q := s.db.Where("tenant_id = ?", tenantID).Order("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Find(&records).Error
	return records, err
}
