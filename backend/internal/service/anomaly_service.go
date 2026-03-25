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

// DetectAnomaly 检测指标异常（含降噪策略）
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

	// 3. 降噪策略 1：检查业务日历（节假日/大促期间调高阈值）
	adjustedThreshold := s.getBusinessCalendarThreshold(tenantID)
	if deviation < adjustedThreshold {
		return nil, nil // 正常，无异常
	}

	// 4. 降噪策略 2：检查最小沉默期（4 小时内同一指标不重复推送）
	if s.isInSilencePeriod(tenantID, metricID, 4*time.Hour) {
		return nil, nil
	}

	// 5. 降噪策略 3：严重度衰减
	// 检查该指标是否已有 open 状态的异常
	existingAnomalies := s.getExistingOpenAnomalies(tenantID, metricID)
	severity := s.determineSeverityWithDecay(existingAnomalies, deviation)

	// 如果严重度被衰减到 info 以下，则不推送
	if severity == "" {
		return nil, nil
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

// getBusinessCalendarThreshold 获取业务日历调整后的异常检测阈值
// 节假日/大促期间自动调高阈值以减少误报
func (s *AnomalyService) getBusinessCalendarThreshold(tenantID string) float64 {
	baseThreshold := 2.0

	today := time.Now().Format("2006-01-02")
	var calendar model.BusinessCalendar
	err := s.db.Where("tenant_id = ? AND date = ?", tenantID, today).First(&calendar).Error
	if err != nil {
		return baseThreshold
	}

	// 如果命中业务日历，按配置的阈值倍数调整
	if calendar.Threshold > baseThreshold {
		return calendar.Threshold
	}
	return baseThreshold
}

// getExistingOpenAnomalies 获取该指标已有的 open 异常
func (s *AnomalyService) getExistingOpenAnomalies(tenantID, metricID string) []model.AnomalyEvent {
	var anomalies []model.AnomalyEvent
	s.db.Where("tenant_id = ? AND metric_id = ? AND status = ?",
		tenantID, metricID, model.AnomalyOpen).
		Order("detected_at DESC").
		Limit(3).
		Find(&anomalies)
	return anomalies
}

// determineSeverityWithDecay 严重度衰减：持续异常但无恶化则降低严重度
// - 已有 critical 异常超过 24h 且无新增恶化 -> 降为 warning
// - 已有 warning 异常超过 48h 且无新增恶化 -> 降为 info
// - 偏离程度比上次更大 -> 保持或升级
func (s *AnomalyService) determineSeverityWithDecay(existingAnomalies []model.AnomalyEvent, currentDeviation float64) model.AnomalySeverity {
	// 基础严重度判断
	baseSeverity := model.SeverityInfo
	if currentDeviation >= 3.0 {
		baseSeverity = model.SeverityCritical
	} else if currentDeviation >= 2.0 {
		baseSeverity = model.SeverityWarning
	}

	if len(existingAnomalies) == 0 {
		return baseSeverity
	}

	latest := existingAnomalies[0]
	elapsedHours := time.Since(latest.DetectedAt).Hours()

	// 如果当前偏离比已有异常更大，不衰减
	if currentDeviation > latest.Deviation*1.1 {
		return baseSeverity
	}

	// 严重度衰减规则
	switch latest.Severity {
	case model.SeverityCritical:
		// Critical 超过 24h 无恶化 -> 降为 warning
		if elapsedHours > 24 {
			return model.SeverityWarning
		}
		return model.SeverityCritical

	case model.SeverityWarning:
		// Warning 超过 48h 无恶化 -> 降为 info
		if elapsedHours > 48 {
			return model.SeverityInfo
		}
		// Warning 超过 24h 无恶化 -> 降为 info（更保守的衰减）
		if elapsedHours > 24 {
			return model.SeverityInfo
		}
		return model.SeverityWarning

	case model.SeverityInfo:
		// Info 超过 72h -> 不推送
		if elapsedHours > 72 {
			return ""
		}
		return model.SeverityInfo
	}

	return baseSeverity
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
