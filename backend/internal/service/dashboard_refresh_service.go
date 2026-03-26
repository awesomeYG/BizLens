package service

import (
	"log"
	"sync"
	"time"
)

// RefreshOwnerType 刷新对象类型
type RefreshOwnerType string

const (
	OwnerDashboard RefreshOwnerType = "dashboard"
	OwnerReport    RefreshOwnerType = "report"
)

// RefreshSubscription 刷新订阅信息（支持大屏和报表）
type RefreshSubscription struct {
	OwnerID     string           // dashboard_id 或 report_id
	OwnerType   RefreshOwnerType // dashboard 或 report
	TenantID    string
	DataSources []AutoQueryDataSource
	LastData    *AutoQueryResult
	ticker      *time.Ticker
	stopChan    chan bool
}

// RefreshService 实时刷新服务（支持大屏和报表）
// 复用 AutoQueryService 的缓存层，避免重复查询击穿数据源
type RefreshService struct {
	hub               *Hub
	autoQueryService  *AutoQueryService
	dataSourceService *DataSourceService
	refreshInterval   time.Duration
	subscriptions     map[string]*RefreshSubscription // key: ownerType:ownerID
	mu                sync.RWMutex
}

// NewRefreshService 创建刷新服务
func NewRefreshService(
	hub *Hub,
	autoQueryService *AutoQueryService,
	dataSourceService *DataSourceService,
	refreshInterval time.Duration,
) *RefreshService {
	return &RefreshService{
		hub:               hub,
		autoQueryService:  autoQueryService,
		dataSourceService: dataSourceService,
		refreshInterval:   refreshInterval,
		subscriptions:     make(map[string]*RefreshSubscription),
	}
}

// subscriptionKey 生成订阅键
func subscriptionKey(ownerType RefreshOwnerType, ownerID string) string {
	return string(ownerType) + ":" + ownerID
}

// StartDashboardRefresh 启动大屏数据刷新
func (s *RefreshService) StartDashboardRefresh(dashboardID, tenantID string, dataSources []AutoQueryDataSource) {
	s.startRefresh(OwnerDashboard, dashboardID, tenantID, dataSources)
}

// StopDashboardRefresh 停止大屏刷新
func (s *RefreshService) StopDashboardRefresh(dashboardID string) {
	s.stopRefresh(OwnerDashboard, dashboardID)
}

// StartReportRefresh 启动报表数据刷新
// 报表刷新时复用缓存（同数据源的查询结果被缓存，避免重复查询）
func (s *RefreshService) StartReportRefresh(reportID, tenantID string, dataSources []AutoQueryDataSource) {
	s.startRefresh(OwnerReport, reportID, tenantID, dataSources)
}

// StopReportRefresh 停止报表刷新
func (s *RefreshService) StopReportRefresh(reportID string) {
	s.stopRefresh(OwnerReport, reportID)
}

// startRefresh 内部启动刷新
func (s *RefreshService) startRefresh(ownerType RefreshOwnerType, ownerID, tenantID string, dataSources []AutoQueryDataSource) {
	key := subscriptionKey(ownerType, ownerID)
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.subscriptions[key]; exists {
		return
	}

	sub := &RefreshSubscription{
		OwnerID:     ownerID,
		OwnerType:   ownerType,
		TenantID:    tenantID,
		DataSources: dataSources,
		ticker:      time.NewTicker(s.refreshInterval),
		stopChan:    make(chan bool),
	}

	s.subscriptions[key] = sub
	go s.refreshLoop(sub)
	log.Printf("Started refresh for %s %s (interval: %v, cache enabled: %v)",
		ownerType, ownerID, s.refreshInterval, s.autoQueryService.GetCache() != nil)
}

// stopRefresh 内部停止刷新
func (s *RefreshService) stopRefresh(ownerType RefreshOwnerType, ownerID string) {
	key := subscriptionKey(ownerType, ownerID)
	s.mu.Lock()
	defer s.mu.Unlock()

	if sub, exists := s.subscriptions[key]; exists {
		sub.ticker.Stop()
		close(sub.stopChan)
		delete(s.subscriptions, key)
		log.Printf("Stopped refresh for %s %s", ownerType, ownerID)
	}
}

// refreshLoop 刷新循环
func (s *RefreshService) refreshLoop(sub *RefreshSubscription) {
	// 立即执行一次查询
	s.executeAndBroadcast(sub)

	for {
		select {
		case <-sub.ticker.C:
			s.executeAndBroadcast(sub)
		case <-sub.stopChan:
			return
		}
	}
}

// executeAndBroadcast 执行查询并广播结果
func (s *RefreshService) executeAndBroadcast(sub *RefreshSubscription) {
	req := AutoQueryRequest{
		Question:    "",
		DataSources: sub.DataSources,
	}

	// AutoQueryService 内部会检查缓存，缓存命中时直接返回
	result, err := s.autoQueryService.AutoQuery(sub.TenantID, req)
	if err != nil {
		log.Printf("AutoQuery failed for %s %s: %v", sub.OwnerType, sub.OwnerID, err)
		return
	}

	// 广播数据更新（复用 DashboardID 字段存放 ownerID）
	s.hub.Broadcast(&BroadcastMessage{
		DashboardID: sub.OwnerID,
		OwnerType:   sub.OwnerType,
		TenantID:    sub.TenantID,
		Data:        result,
	})

	sub.LastData = result
}

// GetActiveSubscriptions 返回当前活跃的订阅数量
func (s *RefreshService) GetActiveSubscriptions() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.subscriptions)
}
