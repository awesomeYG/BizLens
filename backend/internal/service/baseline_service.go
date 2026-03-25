package service

import (
	"ai-bi-server/internal/model"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

// BaselineService 基线学习服务
type BaselineService struct {
	db *gorm.DB
}

func NewBaselineService(db *gorm.DB) *BaselineService {
	return &BaselineService{db: db}
}

// LearnBaseline 学习指标基线（移动平均算法）
func (s *BaselineService) LearnBaseline(tenantID, metricID string, granularity string, windowDays int) error {
	// 1. 从数据源查询历史数据（这里简化为从 metric 相关表查询）
	// 实际应该根据 metricID 找到对应的数据源和查询逻辑

	// 2. 计算统计指标
	var values []float64
	// TODO: 实际查询逻辑，这里用模拟数据
	values = s.fetchHistoricalValues(tenantID, metricID, windowDays)

	if len(values) == 0 {
		return fmt.Errorf("无历史数据")
	}

	// 3. 计算期望值和标准差
	expected := mean(values)
	stdDev := standardDeviation(values, expected)

	// 4. 保存基线
	now := time.Now()
	periodKey := s.getPeriodKey(now, granularity)

	baseline := &model.MetricBaseline{
		TenantID:      tenantID,
		MetricID:      metricID,
		Granularity:   granularity,
		PeriodKey:     periodKey,
		ExpectedValue: expected,
		StdDev:        stdDev,
		UpperBound:    expected + 2*stdDev, // 2σ 上界
		LowerBound:    expected - 2*stdDev, // 2σ 下界
		SampleCount:   len(values),
		Method:        "moving_avg",
		ComputedAt:    now,
	}

	return s.db.Create(baseline).Error
}

// GetBaseline 获取指标基线
func (s *BaselineService) GetBaseline(tenantID, metricID, granularity string) (*model.MetricBaseline, error) {
	var baseline model.MetricBaseline
	now := time.Now()
	periodKey := s.getPeriodKey(now, granularity)

	err := s.db.Where("tenant_id = ? AND metric_id = ? AND granularity = ? AND period_key = ?",
		tenantID, metricID, granularity, periodKey).
		Order("computed_at DESC").
		First(&baseline).Error

	if err != nil {
		return nil, err
	}
	return &baseline, nil
}

// 辅助函数
func (s *BaselineService) getPeriodKey(t time.Time, granularity string) string {
	switch granularity {
	case "hourly":
		return t.Format("2006-01-02T15")
	case "daily":
		return t.Format("2006-01-02")
	case "weekly":
		year, week := t.ISOWeek()
		return fmt.Sprintf("%d-W%02d", year, week)
	default:
		return t.Format("2006-01-02")
	}
}

func (s *BaselineService) fetchHistoricalValues(tenantID, metricID string, windowDays int) []float64 {
	// TODO: 实际实现应该查询数据源
	// 这里返回模拟数据用于 MVP 测试
	return []float64{100, 105, 98, 102, 110, 95, 103}
}

// 统计函数
func mean(values []float64) float64 {
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func standardDeviation(values []float64, mean float64) float64 {
	variance := 0.0
	for _, v := range values {
		variance += math.Pow(v-mean, 2)
	}
	return math.Sqrt(variance / float64(len(values)))
}
