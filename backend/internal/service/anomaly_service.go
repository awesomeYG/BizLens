package service

import (
	"ai-bi-server/internal/model"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

// AnomalyService 异常检测服务
type AnomalyService struct {
	db              *gorm.DB
	baselineService *BaselineService
	imService       *IMService
}

func NewAnomalyService(db *gorm.DB, baselineService *BaselineService, imService *IMService) *AnomalyService {
	return &AnomalyService{
		db:              db,
		baselineService: baselineService,
		imService:       imService,
	}
}

// DetectAnomaly 检测指标异常
func (s *AnomalyService) DetectAnomaly(tenantID, metricID string, actualValue float64) (*model.AnomalyEvent, error) {
	// 1. 获取基线
	baseline, err := s.baselineService.GetBaseline(tenantID, metricID, "daily")
	if err != nil {
		return nil, fmt.Errorf("获取基线失败: %w", err)
	}

	// 2. 计算偏离程度
	deviation := 0.0
	if baseline.StdDev > 0 {
		deviation = math.Abs(actualValue-baseline.ExpectedValue) / baseline.StdDev
	}

	// 3. 判断是否异常（偏离 > 2σ）
	if deviation < 2.0 {
		return nil, nil // 正常，无异常
	}

	// 4. 降噪：检查最小沉默期（4 小时内同一指标不重复推送）
	if s.isInSilencePeriod(tenantID, metricID, 4*time.Hour) {
		return nil, nil
	}

	// 5. 确定严重度
	severity := model.SeverityWarning
	if deviation >= 3.0 {
		severity = model.SeverityCritical
	}

	// 6. 确定方向
	direction := "up"
	if actualValue < baseline.ExpectedValue {
		direction = "down"
	}

	// 7. 创建异常事件
	anomaly := &model.AnomalyEvent{
		TenantID:      tenantID,
		MetricID:      metricID,
		DetectedAt:    time.Now(),
		ActualValue:   actualValue,
		ExpectedValue: baseline.ExpectedValue,
		Deviation:     deviation,
		Severity:      severity,
		Confidence:    0.85, // MVP 固定置信度
		Direction:     direction,
		Status:        model.AnomalyOpen,
	}

	if err := s.db.Create(anomaly).Error; err != nil {
		return nil, err
	}

	return anomaly, nil
}

// NotifyAnomaly 推送异常通知到 IM
func (s *AnomalyService) NotifyAnomaly(tenantID string, anomaly *model.AnomalyEvent, platformIDs []string) error {
	// 构建消息
	emoji := "⚠️"
	if anomaly.Severity == model.SeverityCritical {
		emoji = "🚨"
	}

	changePercent := ((anomaly.ActualValue - anomaly.ExpectedValue) / anomaly.ExpectedValue) * 100
	message := fmt.Sprintf(
		"%s **[异常检测]**\n\n"+
			"**指标**: %s\n"+
			"**当前值**: %.2f\n"+
			"**基线值**: %.2f\n"+
			"**变化**: %.1f%%\n"+
			"**严重度**: %s\n"+
			"**置信度**: %.0f%%\n\n"+
			"检测时间: %s",
		emoji,
		anomaly.MetricID,
		anomaly.ActualValue,
		anomaly.ExpectedValue,
		changePercent,
		anomaly.Severity,
		anomaly.Confidence*100,
		anomaly.DetectedAt.Format("2006-01-02 15:04:05"),
	)

	// 推送到所有平台
	s.imService.SendNotification(tenantID, platformIDs, "anomaly_alert", "异常告警", message, true)

	// 更新通知时间
	now := time.Now()
	anomaly.NotifiedAt = &now
	s.db.Save(anomaly)

	return nil
}

// isInSilencePeriod 检查是否在沉默期内
func (s *AnomalyService) isInSilencePeriod(tenantID, metricID string, duration time.Duration) bool {
	var count int64
	cutoff := time.Now().Add(-duration)

	s.db.Model(&model.AnomalyEvent{}).
		Where("tenant_id = ? AND metric_id = ? AND detected_at > ? AND status = ?",
			tenantID, metricID, cutoff, model.AnomalyOpen).
		Count(&count)

	return count > 0
}

// ListAnomalies 获取异常列表
func (s *AnomalyService) ListAnomalies(tenantID string, status model.AnomalyStatus, limit int) ([]model.AnomalyEvent, error) {
	var anomalies []model.AnomalyEvent
	query := s.db.Where("tenant_id = ?", tenantID)

	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Order("detected_at DESC").Limit(limit).Find(&anomalies).Error
	return anomalies, err
}
