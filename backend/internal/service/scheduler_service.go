package service

import (
	"ai-bi-server/internal/model"
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
	dataSourceService   *DataSourceService
	metricService       *MetricService
	imService           *IMService
}

// NewSchedulerService 创建调度服务
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

// SetDataDependencies 设置数据依赖（延迟注入）
func (s *SchedulerService) SetDataDependencies(dsSvc *DataSourceService, metricSvc *MetricService, imSvc *IMService) {
	s.dataSourceService = dsSvc
	s.metricService = metricSvc
	s.imService = imSvc
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

	// 启动后延迟 30 秒执行第一次（等待服务初始化完成）
	time.Sleep(30 * time.Second)
	s.executeHourlyTasks()

	for range ticker.C {
		s.executeHourlyTasks()
	}
}

// executeHourlyTasks 执行每小时任务（遍历所有租户和指标）
func (s *SchedulerService) executeHourlyTasks() {
	log.Println("执行每小时任务：基线学习 + 异常检测")

	// 1. 获取所有租户
	tenants := s.getAllTenants()

	for _, tenant := range tenants {
		s.processMetricsForTenant(tenant.ID)
	}
}

// processMetricsForTenant 处理单个租户的所有指标
func (s *SchedulerService) processMetricsForTenant(tenantID string) {
	// 获取租户的已确认/活跃指标
	var metrics []model.Metric
	if s.metricService != nil {
		confirmed, _ := s.metricService.ListMetrics(tenantID, "", "confirmed")
		active, _ := s.metricService.ListMetrics(tenantID, "", "active")
		metrics = append(confirmed, active...)
	}

	if len(metrics) == 0 {
		return
	}

	// 获取租户的 IM 平台 ID（用于异常通知）
	platformIDs := s.getTenantPlatformIDs(tenantID)

	for _, metric := range metrics {
		// 1. 学习基线
		if err := s.baselineService.LearnBaseline(tenantID, metric.ID, "daily", 7); err != nil {
			log.Printf("[%s] 基线学习失败 metric=%s: %v", tenantID, metric.ID, err)
			continue
		}

		// 2. 查询当前值
		actualValue, err := s.baselineService.QueryCurrentValue(tenantID, metric.ID)
		if err != nil {
			log.Printf("[%s] 查询当前值失败 metric=%s: %v", tenantID, metric.ID, err)
			continue
		}

		if actualValue == 0 {
			continue // 当前值为 0，可能无数据，跳过
		}

		// 3. 检测异常
		anomaly, err := s.anomalyService.DetectAnomaly(tenantID, metric.ID, actualValue)
		if err != nil {
			log.Printf("[%s] 异常检测失败 metric=%s: %v", tenantID, metric.ID, err)
			continue
		}

		// 4. 如果有异常，推送通知
		if anomaly != nil {
			log.Printf("[%s] 检测到异常: metric=%s, value=%.2f, deviation=%.2f",
				tenantID, metric.ID, actualValue, anomaly.Deviation)

			if len(platformIDs) > 0 {
				s.anomalyService.NotifyAnomaly(tenantID, anomaly, platformIDs)
			}
		}
	}
}

// getAllTenants 获取所有租户
func (s *SchedulerService) getAllTenants() []model.Tenant {
	var tenants []model.Tenant
	s.db.Find(&tenants)
	return tenants
}

// getTenantPlatformIDs 获取租户已启用的 IM 平台 ID
func (s *SchedulerService) getTenantPlatformIDs(tenantID string) []string {
	var configs []model.IMConfig
	s.db.Where("tenant_id = ? AND is_active = ?", tenantID, true).Find(&configs)

	ids := make([]string, 0, len(configs))
	for _, c := range configs {
		ids = append(ids, c.ID)
	}
	return ids
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

// executeDailySummary 执行每日摘要（遍历所有租户）
func (s *SchedulerService) executeDailySummary() {
	log.Println("执行每日摘要任务")

	tenants := s.getAllTenants()
	for _, tenant := range tenants {
		platformIDs := s.getTenantPlatformIDs(tenant.ID)

		if err := s.dailySummaryService.SendDailySummary(tenant.ID, platformIDs); err != nil {
			log.Printf("[%s] 发送每日摘要失败: %v", tenant.ID, err)
		} else {
			log.Printf("[%s] 每日摘要已发送", tenant.ID)
		}
	}
}
