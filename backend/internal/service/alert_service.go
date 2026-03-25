package service

import (
	"ai-bi-server/internal/im"
	"ai-bi-server/internal/model"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

type AlertService struct {
	db        *gorm.DB
	imService *IMService
}

func NewAlertService(db *gorm.DB, imService *IMService) *AlertService {
	return &AlertService{db: db, imService: imService}
}

// ListEvents 获取租户下所有告警事件
func (s *AlertService) ListEvents(tenantID string) ([]model.AlertEvent, error) {
	var events []model.AlertEvent
	err := s.db.Where("tenant_id = ?", tenantID).Order("created_at DESC").Find(&events).Error
	return events, err
}

// GetEvent 获取单个告警事件
func (s *AlertService) GetEvent(tenantID, id string) (*model.AlertEvent, error) {
	var event model.AlertEvent
	err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&event).Error
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// CreateEvent 创建告警事件
func (s *AlertService) CreateEvent(tenantID string, event *model.AlertEvent) error {
	event.TenantID = tenantID
	return s.db.Create(event).Error
}

// UpdateEvent 更新告警事件
func (s *AlertService) UpdateEvent(tenantID, id string, updates map[string]interface{}) (*model.AlertEvent, error) {
	var event model.AlertEvent
	if err := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).First(&event).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&event).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &event, nil
}

// DeleteEvent 删除告警事件
func (s *AlertService) DeleteEvent(tenantID, id string) error {
	result := s.db.Where("tenant_id = ? AND id = ?", tenantID, id).Delete(&model.AlertEvent{})
	if result.RowsAffected == 0 {
		return errors.New("告警事件不存在")
	}
	return result.Error
}

// TriggerEvent 手动触发告警（也可被定时任务调用）
func (s *AlertService) TriggerEvent(tenantID, eventID string, actualValue float64) (*model.AlertTriggerLog, error) {
	event, err := s.GetEvent(tenantID, eventID)
	if err != nil {
		return nil, err
	}
	if !event.Enabled {
		return nil, errors.New("该告警已禁用")
	}

	// 检查条件是否满足
	triggered := false
	switch event.ConditionType {
	case model.AlertCondGreater:
		triggered = actualValue > event.Threshold
	case model.AlertCondLess:
		triggered = actualValue < event.Threshold
	case model.AlertCondEquals:
		triggered = actualValue == event.Threshold
	case model.AlertCondChange:
		triggered = true // 变化类型由外部判断
	case model.AlertCondCustom:
		triggered = true // 自定义条件由 AI 判断
	}

	if !triggered {
		return nil, nil
	}

	// 发送通知到配置的平台
	now := time.Now()
	log := &model.AlertTriggerLog{
		TenantID:    tenantID,
		EventID:     eventID,
		EventName:   event.Name,
		Metric:      event.Metric,
		ActualValue: actualValue,
		Threshold:   event.Threshold,
		Message:     event.Message,
		Status:      "sent",
		TriggeredAt: now,
	}

	if event.PlatformIDs != "" {
		platformIDs := strings.Split(event.PlatformIDs, ",")
		for _, pid := range platformIDs {
			pid = strings.TrimSpace(pid)
			if pid == "" {
				continue
			}
			cfg, err := s.imService.GetConfig(tenantID, pid)
			if err != nil || !cfg.Enabled {
				continue
			}
			adapter := im.GetAdapter(cfg.Type)
			if adapter == nil {
				continue
			}
			result := adapter.Send(cfg.WebhookURL, im.Message{
				Title:    "🔔 " + event.Name,
				Content:  event.Message,
				Markdown: true,
				Keyword:  cfg.Keyword,
			}, cfg.Secret)
			if !result.Success {
				log.Status = "failed"
				log.Error = result.Error
			}
		}
	}

	s.db.Create(log)
	return log, nil
}

// ListTriggerLogs 获取告警触发历史
func (s *AlertService) ListTriggerLogs(tenantID string, limit int) ([]model.AlertTriggerLog, error) {
	var logs []model.AlertTriggerLog
	q := s.db.Where("tenant_id = ?", tenantID).Order("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Find(&logs).Error
	return logs, err
}
