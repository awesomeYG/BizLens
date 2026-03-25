package service

import (
	"ai-bi-server/internal/model"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// DailySummaryService 每日摘要服务
type DailySummaryService struct {
	db             *gorm.DB
	anomalyService *AnomalyService
	imService      *IMService
}

func NewDailySummaryService(db *gorm.DB, anomalyService *AnomalyService, imService *IMService) *DailySummaryService {
	return &DailySummaryService{
		db:             db,
		anomalyService: anomalyService,
		imService:      imService,
	}
}

// SummaryContent 摘要内容结构
type SummaryContent struct {
	HealthScore int              `json:"healthScore"`
	Metrics     []MetricSummary  `json:"metrics"`
	Anomalies   []AnomalySummary `json:"anomalies"`
	Trends      []string         `json:"trends"`
}

type MetricSummary struct {
	Name         string  `json:"name"`
	CurrentValue float64 `json:"currentValue"`
	Change       float64 `json:"change"`    // 百分比
	Direction    string  `json:"direction"` // up/down/stable
}

type AnomalySummary struct {
	MetricID string  `json:"metricId"`
	Severity string  `json:"severity"`
	Change   float64 `json:"change"`
}

// GenerateDailySummary 生成每日摘要
func (s *DailySummaryService) GenerateDailySummary(tenantID string) (*model.DailySummary, error) {
	today := time.Now().Format("2006-01-02")

	// 1. 获取今日异常
	anomalies, _ := s.anomalyService.ListAnomalies(tenantID, model.AnomalyOpen, 10)

	// 2. 计算健康评分（100 - 异常数量 * 5，最低 0）
	healthScore := 100 - len(anomalies)*5
	if healthScore < 0 {
		healthScore = 0
	}

	// 3. 构建摘要内容
	content := SummaryContent{
		HealthScore: healthScore,
		Metrics:     []MetricSummary{}, // TODO: 实际查询指标
		Anomalies:   []AnomalySummary{},
		Trends:      []string{},
	}

	for _, a := range anomalies {
		content.Anomalies = append(content.Anomalies, AnomalySummary{
			MetricID: a.MetricID,
			Severity: string(a.Severity),
			Change:   ((a.ActualValue - a.ExpectedValue) / a.ExpectedValue) * 100,
		})
	}

	contentJSON, _ := json.Marshal(content)

	// 4. 保存摘要
	summary := &model.DailySummary{
		TenantID:    tenantID,
		SummaryDate: today,
		HealthScore: healthScore,
		Content:     string(contentJSON),
	}

	if err := s.db.Create(summary).Error; err != nil {
		return nil, err
	}

	return summary, nil
}

// SendDailySummary 发送每日摘要到 IM
func (s *DailySummaryService) SendDailySummary(tenantID string, platformIDs []string) error {
	summary, err := s.GenerateDailySummary(tenantID)
	if err != nil {
		return err
	}

	// 解析内容
	var content SummaryContent
	json.Unmarshal([]byte(summary.Content), &content)

	// 构建消息
	message := fmt.Sprintf(
		"📊 **每日业务摘要**\n\n"+
			"日期：%s\n"+
			"健康评分：%d/100\n\n",
		summary.SummaryDate,
		content.HealthScore,
	)

	if len(content.Anomalies) > 0 {
		message += "**需要关注** ⚠️\n"
		for _, a := range content.Anomalies {
			message += fmt.Sprintf("- %s: %.1f%% 变化\n", a.MetricID, a.Change)
		}
	} else {
		message += "✅ 今日无异常，业务运行正常\n"
	}

	// 推送
	s.imService.SendNotification(tenantID, platformIDs, "daily_summary", "每日业务摘要", message, true)

	// 更新发送时间
	now := time.Now()
	summary.SentAt = &now
	s.db.Save(summary)

	return nil
}
