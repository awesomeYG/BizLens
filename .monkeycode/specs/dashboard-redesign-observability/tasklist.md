# 数据大屏重构实施任务清单

> 版本: v1.0
> 日期: 2026-03-26
> 总预计工时: 约 8-10 天

---

## Phase 1: 后端基础 (P0, 预计 3-4 天)

### 1.1 数据模型

- [ ] **Task-1**: 在 `backend/internal/model/model.go` 中新增 4 个模型
  - `MetricBaseline` (基线快照)
  - `AnomalyEvent` (异常事件)
  - `DailySummary` (每日摘要)
  - `HealthScoreSnapshot` (健康评分快照)
  - 在 `cmd/main.go` 的 AutoMigrate 中注册新模型
  - 预计: 2h

### 1.2 服务层

- [ ] **Task-2**: 实现 `BaselineService`
  - 文件: `backend/internal/service/baseline_service.go`
  - 核心方法: `ComputeBaseline`, `ComputeAllBaselines`, `GetBaseline`, `GetBaselineHistory`
  - 算法: 移动平均法 (30 天窗口, mean +/- 2*stddev)
  - 依赖: MetricService (语义层), DataSourceService (数据源查询)
  - 预计: 4h

- [ ] **Task-3**: 实现 `AnomalyDetectionService`
  - 文件: `backend/internal/service/anomaly_detection_service.go`
  - 核心方法: `DetectAnomalies`, `DetectSingleMetric`, `AcknowledgeAnomaly`, `ResolveAnomaly`, `MarkFalsePositive`, `ListAnomalies`
  - 算法: 统计阈值检测 (1.5x/2x/3x 标准差 -> info/warning/critical)
  - 降噪: 4h 沉默期 + severity 不升级则跳过
  - 依赖: BaselineService, MetricService, IMService
  - 预计: 4h

- [ ] **Task-4**: 实现 `InsightService`
  - 文件: `backend/internal/service/insight_service.go`
  - 核心方法: `GenerateInsights`, `ComputeHealthScore`
  - 健康评分: 加权平均各核心指标的偏离评分
  - 洞察规则: trend_up/trend_down/new_high/new_low/recovery
  - 依赖: BaselineService, MetricService
  - 预计: 4h

- [ ] **Task-5**: 实现 `DailySummaryService`
  - 文件: `backend/internal/service/daily_summary_service.go`
  - 核心方法: `GenerateAndSend`, `GetSummary`, `ListSummaries`
  - 摘要内容: 健康评分 + 核心指标 + 异常 + 洞察
  - IM 推送: 复用现有 IMService，新增 anomaly_alert/daily_summary 消息模板
  - 依赖: InsightService, AnomalyDetectionService, IMService
  - 预计: 3h

- [ ] **Task-6**: 实现 `CronScheduler`
  - 文件: `backend/internal/service/cron_scheduler.go`
  - 定时任务: 基线计算(02:00) + 异常检测(每小时) + 每日摘要(09:00) + 健康评分快照(23:55)
  - 实现: Go goroutine + time.Ticker (MVP 简易版)
  - 在 `cmd/main.go` 中初始化并启动
  - 预计: 2h

### 1.3 API 层

- [ ] **Task-7**: 实现 Observability API Handler
  - 文件: `backend/internal/handler/observability_handler.go`
  - API 端点:
    - `GET /observability/health-score`
    - `GET /observability/core-metrics`
    - `GET /observability/anomalies`
    - `GET /observability/anomalies/{id}`
    - `PUT /observability/anomalies/{id}/acknowledge`
    - `PUT /observability/anomalies/{id}/resolve`
    - `PUT /observability/anomalies/{id}/false-positive`
    - `GET /observability/insights`
    - `GET /observability/summaries`
    - `GET /observability/summaries/{date}`
    - `POST /observability/summaries/generate`
  - 在 `cmd/main.go` 中注册路由 (JWT 中间件保护)
  - 预计: 4h

- [ ] **Task-8**: 新增 IM 消息模板
  - 修改: `backend/internal/im/` 相关文件
  - 新增模板: `anomaly_alert` (异常告警卡片) + `daily_summary` (每日摘要)
  - 适配飞书/钉钉 Markdown 消息格式
  - 预计: 2h

---

## Phase 2: 前端观测中心 (P0, 预计 3-4 天)

### 2.1 基础层

- [ ] **Task-9**: 前端 API 封装
  - 文件: `frontend/lib/observability-api.ts`
  - 函数: getHealthScore, getCoreMetrics, listAnomalies, acknowledgeAnomaly, resolveAnomaly, markFalsePositive, listInsights, listSummaries, getSummary, generateSummary
  - 统一 request 函数 (JWT token + tenant routing)
  - 预计: 1h

- [ ] **Task-10**: 前端类型定义
  - 修改: `frontend/lib/types.ts`
  - 新增类型: HealthScoreResponse, CoreMetric, AnomalyEventDTO, AnomalyFilter, Insight, DailySummaryDTO
  - 预计: 1h

### 2.2 组件层

- [ ] **Task-11**: HealthScoreCard 组件
  - 文件: `frontend/components/observability/HealthScoreCard.tsx`
  - 功能: 圆环进度条 + 分数 + 等级标签 + 趋势 Sparkline + 较昨日变化
  - 颜色映射: excellent(绿)/good(蓝绿)/attention(黄)/warning(橙)/danger(红)
  - 预计: 3h

- [ ] **Task-12**: MetricKpiCard 增强版
  - 文件: `frontend/components/observability/MetricKpiCard.tsx`
  - 功能: 指标值 + 同比环比 + Sparkline + 异常状态边框 + 基线参考线
  - 异常视觉: warning(橙色边框), critical(红色边框+脉冲)
  - 预计: 3h

- [ ] **Task-13**: AnomalyFeed + AnomalyEventCard
  - 文件: `frontend/components/observability/AnomalyFeed.tsx`
  - 功能: 时间线布局 + 事件卡片 + 展开/折叠 + 操作按钮
  - 操作: 确认/解决/误报/AI追问
  - critical 事件: 红色边框 + 脉冲背景
  - 预计: 4h

- [ ] **Task-14**: InsightCarousel
  - 文件: `frontend/components/observability/InsightCarousel.tsx`
  - 功能: 水平滚动洞察卡片 + 类型着色(正面/负面/中性)
  - 预计: 2h

- [ ] **Task-15**: DailySummarySection
  - 文件: `frontend/components/observability/DailySummarySection.tsx`
  - 功能: 可折叠的摘要面板 + 历史摘要列表 + 查看/生成按钮
  - 预计: 2h

### 2.3 页面层

- [ ] **Task-16**: ObservabilityCenter 页面组装
  - 文件: `frontend/components/observability/ObservabilityCenter.tsx`
  - 组装: HealthScoreCard + CoreMetricsGrid + AnomalyFeed + InsightCarousel + TrendCharts + DailySummarySection
  - 时间范围切换联动
  - 数据加载状态 + 错误处理
  - 预计: 3h

- [ ] **Task-17**: dashboards/page.tsx 重构
  - 修改: `frontend/app/dashboards/page.tsx`
  - 改为 Tab 布局: "观测中心"(默认) + "我的看板"
  - "观测中心" Tab 渲染 ObservabilityCenter
  - "我的看板" Tab 保留现有模板画廊 + 大屏实例逻辑
  - URL 参数兼容: `?tab=boards` 切换到看板, `?id=xxx` 直接打开看板
  - 预计: 2h

- [ ] **Task-18**: 未配置状态引导页
  - 文件: `frontend/components/observability/OnboardingGuide.tsx`
  - 条件判断: 无数据源 / 无语义层指标 / 首次使用
  - 步骤引导: 连接数据源 -> 配置指标 -> 开始监控
  - 预计: 2h

- [ ] **Task-19**: AppHeader 导航文案更新
  - 修改: `frontend/components/AppHeader.tsx`
  - "数据大屏" -> "观测中心"
  - 预计: 0.5h

---

## Phase 3: 集成与优化 (P1, 预计 2 天)

- [ ] **Task-20**: 根因分析基础版
  - 文件: `backend/internal/service/rootcause_service.go`
  - 功能: 对异常指标自动按已定义维度下钻，找到贡献度最高的维度值
  - 算法: 遍历各维度分组聚合，计算各组对总体偏离的贡献比
  - 预计: 4h

- [ ] **Task-21**: RootCausePanel 前端组件
  - 文件: `frontend/components/observability/RootCausePanel.tsx`
  - 功能: 在异常事件展开区域渲染根因分析结果
  - 展示: 假设列表(置信度+贡献度) + 维度下钻可视化 + 建议
  - 预计: 3h

- [ ] **Task-22**: 异常 -> AI 对话跳转
  - 修改: AnomalyEventCard 的"AI追问"按钮
  - 功能: 跳转到 `/chat` 并预填上下文 (指标名、异常描述、根因摘要)
  - 预计: 2h

- [ ] **Task-23**: 趋势图表区(预测叠加)
  - 文件: `frontend/components/observability/TrendChartWithPrediction.tsx`
  - 功能: ECharts 折线图 + 预测虚线 + 置信区间阴影
  - 数据: 基于基线数据外推未来 7 天
  - 预计: 3h

- [ ] **Task-24**: 端到端测试验证
  - 验证: 完整流程 (数据源连接 -> 指标配置 -> 基线计算 -> 异常检测 -> 推送 -> 观测中心展示)
  - 验证: API 认证正确性
  - 预计: 3h

- [ ] **Task-25**: 向后兼容验证
  - 验证: 旧版大屏实例在"我的看板"中正常渲染
  - 验证: AI 对话中 dashboard_config 功能不受影响
  - 验证: `/dashboard` 重定向正常
  - 预计: 2h

---

## 总结

| Phase | 任务数 | 预计工时 | 核心交付物 |
|-------|--------|---------|-----------|
| Phase 1 | 8 | 25h (3-4天) | 后端完整服务层 + API + 调度器 |
| Phase 2 | 11 | 23.5h (3-4天) | 前端观测中心完整页面 |
| Phase 3 | 6 | 15h (2天) | 根因分析 + 预测 + 集成验证 |
| **总计** | **25** | **63.5h (8-10天)** | **业务健康观测中心 MVP** |
