package service

import (
	"log"
	"sync"
	"time"
)

// DashboardRefreshService Dashboard 实时刷新服务
type DashboardRefreshService struct {
	hub               *Hub
	autoQueryService  *AutoQueryService
	dataSourceService *DataSourceService
	refreshInterval   time.Duration
	activeDashboards  map[string]*DashboardSubscription
	mu                sync.RWMutex
}

// DashboardSubscription Dashboard 订阅信息
type DashboardSubscription struct {
	DashboardID string
	TenantID    string
	DataSources []AutoQueryDataSource
	LastData    *AutoQueryResult
	ticker      *time.Ticker
	stopChan    chan bool
}

// NewDashboardRefreshService 创建 DashboardRefreshService
func NewDashboardRefreshService(
	hub *Hub,
	autoQueryService *AutoQueryService,
	dataSourceService *DataSourceService,
	refreshInterval time.Duration,
) *DashboardRefreshService {
	return &DashboardRefreshService{
		hub:               hub,
		autoQueryService:  autoQueryService,
		dataSourceService: dataSourceService,
		refreshInterval:   refreshInterval,
		activeDashboards:  make(map[string]*DashboardSubscription),
	}
}

// StartRefresh 启动 dashboard 数据刷新
func (s *DashboardRefreshService) StartRefresh(dashboardID, tenantID string, dataSources []AutoQueryDataSource) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 如果已经在刷新，跳过
	if _, exists := s.activeDashboards[dashboardID]; exists {
		return
	}

	sub := &DashboardSubscription{
		DashboardID: dashboardID,
		TenantID:    tenantID,
		DataSources: dataSources,
		ticker:      time.NewTicker(s.refreshInterval),
		stopChan:    make(chan bool),
	}

	s.activeDashboards[dashboardID] = sub

	go s.refreshLoop(sub)
	log.Printf("Started refresh for dashboard %s (interval: %v)", dashboardID, s.refreshInterval)
}

// StopRefresh 停止 dashboard 数据刷新
func (s *DashboardRefreshService) StopRefresh(dashboardID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if sub, exists := s.activeDashboards[dashboardID]; exists {
		sub.ticker.Stop()
		close(sub.stopChan)
		delete(s.activeDashboards, dashboardID)
		log.Printf("Stopped refresh for dashboard %s", dashboardID)
	}
}

// refreshLoop 刷新循环
func (s *DashboardRefreshService) refreshLoop(sub *DashboardSubscription) {
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
func (s *DashboardRefreshService) executeAndBroadcast(sub *DashboardSubscription) {
	req := AutoQueryRequest{
		Question:    "",
		DataSources: sub.DataSources,
	}

	result, err := s.autoQueryService.AutoQuery(sub.TenantID, req)
	if err != nil {
		log.Printf("AutoQuery failed for dashboard %s: %v", sub.DashboardID, err)
		return
	}

	// 广播数据更新
	s.hub.Broadcast(&BroadcastMessage{
		DashboardID: sub.DashboardID,
		TenantID:    sub.TenantID,
		Data:        result,
	})

	sub.LastData = result
}
