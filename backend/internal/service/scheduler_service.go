package service

import (
	"log"
	"time"

	"gorm.io/gorm"
)

// SchedulerService 调度服务
type SchedulerService struct {
	db                  *gorm.DB
	baselineService     *BaselineService
	anomalyService      *AnomalyService
	dailySummaryService *DailySummaryService
}

func NewSchedulerService(
	db *gorm.DB,
	baselineService *BaselineService,
	anomalyService *AnomalyService,
	dailySummaryService *DailySummaryService,
) *SchedulerService {
	return &SchedulerService{
		db:                  db,
		baselineService:     baselineService,
		anomalyService:      anomalyService,
		dailySummaryService: dailySummaryService,
	}
}

// Start 启动调度任务
func (s *SchedulerService) Start() {
	// 每小时执行：基线学习 + 异常检测
	go s.runHourlyTasks()

	// 每天早上 9 点：发送每日摘要
	go s.runDailySummaryTask()

	log.Println("调度服务已启动")
}

// runHourlyTasks 每小时任务
func (s *SchedulerService) runHourlyTasks() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	// 立即执行一次
	s.executeHourlyTasks()

	for range ticker.C {
		s.executeHourlyTasks()
	}
}

func (s *SchedulerService) executeHourlyTasks() {
	log.Println("执行每小时任务：基线学习 + 异常检测")

	// TODO: 遍历所有租户和指标
	// 这里简化为示例
	tenantID := "demo"
	metricID := "gmv"

	// 1. 学习基线
	if err := s.baselineService.LearnBaseline(tenantID, metricID, "daily", 7); err != nil {
		log.Printf("基线学习失败: %v", err)
	}

	// 2. 检测异常（模拟实际值）
	actualValue := 85000.0 // TODO: 从数据源查询实际值
	anomaly, err := s.anomalyService.DetectAnomaly(tenantID, metricID, actualValue)
	if err != nil {
		log.Printf("异常检测失败: %v", err)
		return
	}

	// 3. 如果有异常，推送通知
	if anomaly != nil {
		platformIDs := []string{} // TODO: 从租户配置获取
		s.anomalyService.NotifyAnomaly(tenantID, anomaly, platformIDs)
		log.Printf("检测到异常并已推送: %s", anomaly.ID)
	}
}

// runDailySummaryTask 每日摘要任务
func (s *SchedulerService) runDailySummaryTask() {
	for {
		now := time.Now()
		// 计算下一个 9:00 的时间
		next := time.Date(now.Year(), now.Month(), now.Day(), 9, 0, 0, 0, now.Location())
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}

		duration := next.Sub(now)
		log.Printf("下次每日摘要将在 %s 后执行", duration)

		time.Sleep(duration)
		s.executeDailySummary()
	}
}

func (s *SchedulerService) executeDailySummary() {
	log.Println("执行每日摘要任务")

	// TODO: 遍历所有租户
	tenantID := "demo"
	platformIDs := []string{} // TODO: 从租户配置获取

	if err := s.dailySummaryService.SendDailySummary(tenantID, platformIDs); err != nil {
		log.Printf("发送每日摘要失败: %v", err)
	}
}
