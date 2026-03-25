# Week2 技术设计文档：根因分析引擎增强 + 每日摘要增强 + 真实数据源集成

> 版本：v1.0
> 日期：2026-03-25
> 对应需求：`requirements.md`
> 状态：待评审

---

## 一、系统架构概览

### 1.1 数据流向

```
调度引擎 (SchedulerService)
  |
  +-- 遍历所有租户 (tenants 表)
  |     |
  |     +-- 遍历该租户所有活跃指标 (metrics 表)
  |           |
  |           +-- 查询真实数据源获取当前值 (DataSourceService.ExecuteQuery)
  |           |
  |           +-- 基线学习 (BaselineService.LearnBaseline) -- 从数据源查询历史数据
  |           |
  |           +-- 异常检测 (AnomalyService.DetectAnomaly)
  |           |     |
  |           |     +-- 检测到异常? -> 根因分析 (RootCauseService.AnalyzeRootCause)
  |           |     |                    |
  |           |     |                    +-- Step 1: 单维度下钻 (已有)
  |           |     |                    +-- Step 2: 交叉下钻 (新增)
  |           |     |                    +-- Step 3: 时间序列分析 (新增)
  |           |     |                    +-- Step 4: 关联指标验证 (新增)
  |           |     |                    +-- Step 5: AI 摘要生成 (增强)
  |           |     |
  |           |     +-- IM 通知推送
  |           |
  |           +-- 每日摘要 (DailySummaryService.GenerateDailySummary)
  |                 |
  |                 +-- 核心指标速览 (新增: 从数据源查询)
  |                 +-- 趋势预测 (新增: 线性回归)
  |                 +-- 正负面趋势分类 (新增)
  |                 +-- IM 推送
```

### 1.2 核心依赖关系

```
SchedulerService
  -> BaselineService (需要 MetricService, DataSourceService)
  -> AnomalyService (需要 BaselineService, IMService, RootCauseService)
  -> DailySummaryService (需要 AnomalyService, IMService, MetricService, DataSourceService)

RootCauseService (已有, 需增强)
  -> DataSourceService (已有)
  -> MetricService (已有)
```

---

## 二、详细设计

### 2.1 BaselineService 改造 (REQ-W2-001)

#### 2.1.1 新增依赖

```go
type BaselineService struct {
    db                *gorm.DB
    metricService     *MetricService
    dataSourceService *DataSourceService
}

func NewBaselineService(
    db *gorm.DB,
    metricService *MetricService,
    dataSourceService *DataSourceService,
) *BaselineService
```

#### 2.1.2 fetchHistoricalValues 重新实现

```go
// fetchHistoricalValues 从真实数据源查询指标历史数据
func (s *BaselineService) fetchHistoricalValues(
    tenantID, metricID string,
    granularity string,
    windowDays int,
) ([]float64, error) {
    // 1. 获取指标定义
    metric, err := s.metricService.GetMetric(metricID)
    if err != nil {
        return nil, fmt.Errorf("指标不存在: %w", err)
    }

    // 2. 匹配数据源
    ds, err := s.findDataSourceForMetric(tenantID, metric)
    if err != nil {
        return nil, fmt.Errorf("无可用数据源: %w", err)
    }

    // 3. 识别时间字段
    timeField := s.resolveTimeField(tenantID, metric, ds)

    // 4. 构建聚合 SQL
    aggExpr := s.buildAggExpression(metric)
    timeGroup := s.buildTimeGroupExpr(ds.Type, timeField, granularity)
    startTime := time.Now().AddDate(0, 0, -windowDays).Format("2006-01-02")

    sql := fmt.Sprintf(
        "SELECT %s AS period, %s AS value FROM %s WHERE %s >= '%s' GROUP BY %s ORDER BY period",
        timeGroup, aggExpr, metric.BaseTable, timeField, startTime, timeGroup,
    )

    // 5. 执行查询
    rows, err := s.dataSourceService.ExecuteQuery(ds, sql)
    if err != nil {
        return nil, fmt.Errorf("历史数据查询失败: %w", err)
    }

    // 6. 提取数值
    values := make([]float64, 0, len(rows))
    for _, row := range rows {
        if v, ok := toFloat64Safe(row["value"]); ok && v > 0 {
            values = append(values, v)
        }
    }

    return values, nil
}
```

#### 2.1.3 辅助方法

```go
// findDataSourceForMetric 为指标匹配数据源
func (s *BaselineService) findDataSourceForMetric(tenantID string, metric *model.Metric) (*model.DataSource, error) {
    dataSources, err := s.dataSourceService.ListDataSources(tenantID)
    if err != nil {
        return nil, err
    }

    // 优先匹配表名
    for i, ds := range dataSources {
        if ds.Status == model.DSStatusConnected && ds.TableInfo != "" {
            if strings.Contains(strings.ToLower(ds.TableInfo), strings.ToLower(metric.BaseTable)) {
                return &dataSources[i], nil
            }
        }
    }

    // 回退：第一个已连接的数据源
    for i, ds := range dataSources {
        if ds.Status == model.DSStatusConnected {
            return &dataSources[i], nil
        }
    }

    return nil, fmt.Errorf("无已连接数据源")
}

// resolveTimeField 识别时间字段
func (s *BaselineService) resolveTimeField(tenantID string, metric *model.Metric, ds *model.DataSource) string {
    // 1. 先从语义层维度表查找
    var timeDim model.Dimension
    err := s.db.Where("tenant_id = ? AND base_table = ? AND data_type = ? AND status = ?",
        tenantID, metric.BaseTable, model.DimTypeTime, "active").
        First(&timeDim).Error
    if err == nil {
        return timeDim.BaseField
    }

    // 2. 回退到常见命名
    commonTimeFields := []string{"created_at", "order_date", "date", "timestamp", "updated_at", "time"}
    // 解析 tableInfo 查找匹配的时间字段
    // ...省略解析逻辑
    return commonTimeFields[0] // 默认 created_at
}

// buildTimeGroupExpr 构建时间分组表达式（跨方言）
func (s *BaselineService) buildTimeGroupExpr(dsType model.DataSourceType, timeField, granularity string) string {
    switch dsType {
    case model.DataSourcePostgreSQL:
        switch granularity {
        case "hourly":
            return fmt.Sprintf("date_trunc('hour', %s)", timeField)
        case "daily":
            return fmt.Sprintf("date_trunc('day', %s)", timeField)
        case "weekly":
            return fmt.Sprintf("date_trunc('week', %s)", timeField)
        }
    case model.DataSourceMySQL:
        switch granularity {
        case "hourly":
            return fmt.Sprintf("DATE_FORMAT(%s, '%%Y-%%m-%%d %%H:00:00')", timeField)
        case "daily":
            return fmt.Sprintf("DATE(%s)", timeField)
        case "weekly":
            return fmt.Sprintf("DATE(DATE_SUB(%s, INTERVAL WEEKDAY(%s) DAY))", timeField, timeField)
        }
    case model.DataSourceSQLite:
        switch granularity {
        case "hourly":
            return fmt.Sprintf("strftime('%%Y-%%m-%%d %%H:00:00', %s)", timeField)
        case "daily":
            return fmt.Sprintf("date(%s)", timeField)
        case "weekly":
            return fmt.Sprintf("date(%s, 'weekday 0', '-6 days')", timeField)
        }
    }
    return fmt.Sprintf("date(%s)", timeField)
}
```

---

### 2.2 SchedulerService 改造 (REQ-W2-002, REQ-W2-011)

#### 2.2.1 新增依赖

```go
type SchedulerService struct {
    db                  *gorm.DB
    baselineService     *BaselineService
    anomalyService      *AnomalyService
    dailySummaryService *DailySummaryService
    metricService       *MetricService
    dataSourceService   *DataSourceService
    imService           *IMService
}
```

#### 2.2.2 executeHourlyTasks 重写

```go
func (s *SchedulerService) executeHourlyTasks() {
    log.Println("[调度] 开始每小时任务：基线学习 + 异常检测")

    // 1. 获取所有租户
    var tenants []model.Tenant
    if err := s.db.Find(&tenants).Error; err != nil {
        log.Printf("[调度] 获取租户列表失败: %v", err)
        return
    }

    // 2. 并发处理，限制最大并发 10
    sem := make(chan struct{}, 10)
    var wg sync.WaitGroup

    for _, tenant := range tenants {
        wg.Add(1)
        sem <- struct{}{}

        go func(tenantID string) {
            defer wg.Done()
            defer func() { <-sem }()

            s.processHourlyForTenant(tenantID)
        }(tenant.ID)
    }

    wg.Wait()
    log.Println("[调度] 每小时任务完成")
}

func (s *SchedulerService) processHourlyForTenant(tenantID string) {
    log.Printf("[调度][%s] 开始处理", tenantID)

    // 1. 获取该租户的活跃指标
    metrics, err := s.metricService.ListMetrics(tenantID, "", "active")
    if err != nil || len(metrics) == 0 {
        log.Printf("[调度][%s] 无活跃指标，跳过", tenantID)
        return
    }

    // 2. 获取已启用的 IM 平台
    platformIDs := s.getEnabledPlatformIDs(tenantID)

    // 3. 对每个指标执行
    for _, metric := range metrics {
        // 3a. 基线学习
        if err := s.baselineService.LearnBaseline(tenantID, metric.ID, "daily", 7); err != nil {
            log.Printf("[调度][%s] 指标 %s 基线学习失败: %v", tenantID, metric.Name, err)
        }

        // 3b. 查询当前实际值
        actualValue, err := s.queryCurrentValue(tenantID, &metric)
        if err != nil {
            log.Printf("[调度][%s] 指标 %s 查询实际值失败: %v", tenantID, metric.Name, err)
            continue
        }

        // 3c. 异常检测
        anomaly, err := s.anomalyService.DetectAnomaly(tenantID, metric.ID, actualValue)
        if err != nil {
            log.Printf("[调度][%s] 指标 %s 异常检测失败: %v", tenantID, metric.Name, err)
            continue
        }

        if anomaly != nil && len(platformIDs) > 0 {
            s.anomalyService.NotifyAnomaly(tenantID, anomaly, platformIDs)
            log.Printf("[调度][%s] 指标 %s 检测到异常, severity=%s", tenantID, metric.Name, anomaly.Severity)
        }
    }

    log.Printf("[调度][%s] 处理完成，共 %d 个指标", tenantID, len(metrics))
}

// queryCurrentValue 查询指标当前值
func (s *SchedulerService) queryCurrentValue(tenantID string, metric *model.Metric) (float64, error) {
    ds, err := s.findDataSourceForMetric(tenantID, metric)
    if err != nil {
        return 0, err
    }

    timeField := s.resolveTimeField(tenantID, metric, ds)
    aggExpr := buildAggExpression(metric)
    todayStart := time.Now().Format("2006-01-02")

    sql := fmt.Sprintf(
        "SELECT %s AS value FROM %s WHERE %s >= '%s'",
        aggExpr, metric.BaseTable, timeField, todayStart,
    )

    rows, err := s.dataSourceService.ExecuteQuery(ds, sql)
    if err != nil {
        return 0, err
    }

    if len(rows) == 0 {
        return 0, fmt.Errorf("无数据")
    }

    val, ok := toFloat64Safe(rows[0]["value"])
    if !ok {
        return 0, fmt.Errorf("值解析失败")
    }

    return val, nil
}

// getEnabledPlatformIDs 获取租户已启用的 IM 平台 ID
func (s *SchedulerService) getEnabledPlatformIDs(tenantID string) []string {
    var configs []model.IMConfig
    s.db.Where("tenant_id = ? AND enabled = ? AND deleted_at IS NULL", tenantID, true).Find(&configs)

    ids := make([]string, 0, len(configs))
    for _, c := range configs {
        ids = append(ids, c.ID)
    }
    return ids
}
```

---

### 2.3 RootCauseService 增强 (REQ-W2-004 ~ REQ-W2-007)

#### 2.3.1 新数据结构

```go
// CrossDrillDown 交叉下钻结果
type CrossDrillDown struct {
    PrimaryDimension   string             `json:"primaryDimension"`
    PrimaryValue       string             `json:"primaryValue"`
    SecondaryDimension string             `json:"secondaryDimension"`
    Segments           []DimensionSegment `json:"segments"`
    TopContributor     *ContributionFactor `json:"topContributor,omitempty"`
}

// TimeSeriesDetail 时间序列分析
type TimeSeriesDetail struct {
    DataPoints      []TimePoint `json:"dataPoints"`
    InflectionDate  string      `json:"inflectionDate"`  // 拐点日期
    DaysSinceStart  int         `json:"daysSinceStart"`  // 异常持续天数
    TrendDirection  string      `json:"trendDirection"`  // worsening/improving/stable
}

type TimePoint struct {
    Date      string  `json:"date"`
    Value     float64 `json:"value"`
    IsAnomaly bool    `json:"isAnomaly"`
}

// CorrelatedAnomaly 关联指标异常
type CorrelatedAnomaly struct {
    MetricID      string  `json:"metricId"`
    MetricName    string  `json:"metricName"`
    CurrentValue  float64 `json:"currentValue"`
    BaselineValue float64 `json:"baselineValue"`
    ChangePct     float64 `json:"changePct"`
    IsAnomaly     bool    `json:"isAnomaly"`
    Direction     string  `json:"direction"`
}

// RootCauseResult 增强后的根因分析结果
type RootCauseResult struct {
    // ...已有字段保留...
    CrossDrillDowns      []CrossDrillDown    `json:"crossDrillDowns,omitempty"`
    TimeSeriesAnalysis   *TimeSeriesDetail   `json:"timeSeriesAnalysis,omitempty"`
    CorrelatedAnomalies  []CorrelatedAnomaly `json:"correlatedAnomalies,omitempty"`
}
```

#### 2.3.2 AnalyzeRootCause 增强流程

```go
func (s *RootCauseService) AnalyzeRootCause(tenantID string, anomaly *model.AnomalyEvent) (*RootCauseResult, error) {
    // Step 1: 单维度下钻 (已有逻辑，保持不变)
    result := s.performSingleDimensionDrillDown(tenantID, anomaly, metric, dimensions, targetDS)

    // Step 2: 交叉下钻 (新增)
    if len(result.TopFactors) > 0 && math.Abs(result.TopFactors[0].Contribution) > 30 {
        crossDrillDowns := s.performCrossDrillDown(targetDS, metric, dimensions, result.TopFactors[0], totalAbsChange)
        result.CrossDrillDowns = crossDrillDowns
    }

    // Step 3: 时间序列分析 (新增)
    timeSeriesDetail := s.analyzeTimeSeries(targetDS, metric, result)
    result.TimeSeriesAnalysis = timeSeriesDetail

    // Step 4: 关联指标验证 (新增)
    correlatedAnomalies := s.checkCorrelatedMetrics(tenantID, metric, targetDS)
    result.CorrelatedAnomalies = correlatedAnomalies

    // 重新计算置信度（关联指标增强）
    result.Confidence = s.calculateEnhancedConfidence(result)

    // Step 5: 生成增强摘要 (改进)
    result.Summary = s.generateEnhancedSummary(result)

    return result, nil
}
```

#### 2.3.3 交叉下钻实现

```go
func (s *RootCauseService) performCrossDrillDown(
    ds *model.DataSource,
    metric *model.Metric,
    dimensions []model.Dimension,
    topFactor ContributionFactor,
    totalAbsChange float64,
) []CrossDrillDown {
    var results []CrossDrillDown

    // 找到主维度对应的 dimension
    var primaryDim *model.Dimension
    for i, d := range dimensions {
        if d.DisplayName == topFactor.DimensionName || d.Name == topFactor.DimensionName {
            primaryDim = &dimensions[i]
            break
        }
    }
    if primaryDim == nil {
        return results
    }

    // 遍历其他维度做交叉下钻（最多 3 个）
    count := 0
    for _, secDim := range dimensions {
        if secDim.ID == primaryDim.ID || count >= 3 {
            continue
        }

        aggExpr := s.buildAggExpression(metric)
        baseTable := s.quoteIdentifier(ds.Type, metric.BaseTable)
        primField := s.quoteIdentifier(ds.Type, primaryDim.BaseField)
        secField := s.quoteIdentifier(ds.Type, secDim.BaseField)

        // 当前窗口 + 主维度筛选
        currentSQL := fmt.Sprintf(
            "SELECT %s AS dim_value, %s AS metric_value FROM %s WHERE %s = '%s' AND %s GROUP BY %s ORDER BY metric_value DESC LIMIT 10",
            secField, aggExpr, baseTable,
            primField, topFactor.DimensionValue,
            s.buildRecentTimeFilter(ds.Type, metric.BaseTable, 1),
            secField,
        )

        // 基线窗口 + 主维度筛选
        baselineSQL := fmt.Sprintf(
            "SELECT %s AS dim_value, %s / 7.0 AS metric_value FROM %s WHERE %s = '%s' AND %s GROUP BY %s ORDER BY metric_value DESC LIMIT 10",
            secField, aggExpr, baseTable,
            primField, topFactor.DimensionValue,
            s.buildBaselineTimeFilter(ds.Type, metric.BaseTable, 7),
            secField,
        )

        // 执行查询并构建结果...
        crossResult := s.buildCrossDrillDownResult(
            ds, currentSQL, baselineSQL,
            topFactor.DimensionName, topFactor.DimensionValue,
            secDim.DisplayName, totalAbsChange,
        )
        if crossResult != nil {
            results = append(results, *crossResult)
        }
        count++
    }

    return results
}
```

#### 2.3.4 时间序列分析实现

```go
func (s *RootCauseService) analyzeTimeSeries(
    ds *model.DataSource,
    metric *model.Metric,
    result *RootCauseResult,
) *TimeSeriesDetail {
    // 构建条件（如果有交叉下钻结果，加上维度筛选）
    whereClause := s.buildRecentTimeFilter(ds.Type, metric.BaseTable, 7)
    if len(result.CrossDrillDowns) > 0 && result.CrossDrillDowns[0].TopContributor != nil {
        // 加入主维度 + 次维度筛选
        cd := result.CrossDrillDowns[0]
        whereClause += fmt.Sprintf(" AND %s = '%s'", cd.PrimaryDimension, cd.PrimaryValue)
        // 如果有次维度 top contributor
        if cd.TopContributor != nil {
            whereClause += fmt.Sprintf(" AND %s = '%s'", cd.SecondaryDimension, cd.TopContributor.DimensionValue)
        }
    }

    aggExpr := s.buildAggExpression(metric)
    timeField := s.resolveTimeField(ds, metric)
    timeGroup := s.buildTimeGroupExpr(ds.Type, timeField, "daily")

    sql := fmt.Sprintf(
        "SELECT %s AS date_val, %s AS metric_value FROM %s WHERE %s GROUP BY %s ORDER BY date_val",
        timeGroup, aggExpr, metric.BaseTable, whereClause, timeGroup,
    )

    rows, err := s.dataSourceService.ExecuteQuery(ds, sql)
    if err != nil || len(rows) < 3 {
        return nil
    }

    // 提取数据点
    var values []float64
    var dates []string
    for _, row := range rows {
        dateStr := fmt.Sprintf("%v", row["date_val"])
        val, ok := toFloat64Safe(row["metric_value"])
        if ok {
            dates = append(dates, dateStr)
            values = append(values, val)
        }
    }

    // 计算滑动均值和标准差
    windowMean := mean(values)
    windowStdDev := standardDeviation(values, windowMean)

    detail := &TimeSeriesDetail{
        DataPoints: make([]TimePoint, len(values)),
    }

    // 标注异常点，找拐点
    inflectionFound := false
    consecutiveAnomaly := 0
    for i, v := range values {
        isAnomaly := math.Abs(v-windowMean) > 1.5*windowStdDev
        detail.DataPoints[i] = TimePoint{
            Date:      dates[i],
            Value:     math.Round(v*100) / 100,
            IsAnomaly: isAnomaly,
        }

        if isAnomaly {
            consecutiveAnomaly++
            if consecutiveAnomaly >= 2 && !inflectionFound {
                detail.InflectionDate = dates[i-1] // 拐点是第一个异常点
                detail.DaysSinceStart = len(values) - (i - 1)
                inflectionFound = true
            }
        } else {
            consecutiveAnomaly = 0
        }
    }

    // 判断趋势方向
    if len(values) >= 3 {
        recent := values[len(values)-1]
        earlier := values[len(values)-3]
        if recent > earlier*1.05 {
            detail.TrendDirection = "worsening"
        } else if recent < earlier*0.95 {
            detail.TrendDirection = "improving"
        } else {
            detail.TrendDirection = "stable"
        }
    }

    return detail
}
```

#### 2.3.5 关联指标验证实现

```go
func (s *RootCauseService) checkCorrelatedMetrics(
    tenantID string,
    primaryMetric *model.Metric,
    ds *model.DataSource,
) []CorrelatedAnomaly {
    // 查找同 base_table 的其他指标
    var relatedMetrics []model.Metric
    s.db.Where("tenant_id = ? AND base_table = ? AND id != ? AND status = ?",
        tenantID, primaryMetric.BaseTable, primaryMetric.ID, "active").
        Limit(5).Find(&relatedMetrics)

    var results []CorrelatedAnomaly
    for _, m := range relatedMetrics {
        aggExpr := s.buildAggExpression(&m)

        // 当前值
        currentSQL := fmt.Sprintf(
            "SELECT %s AS value FROM %s WHERE %s",
            aggExpr, m.BaseTable,
            s.buildRecentTimeFilter(ds.Type, m.BaseTable, 1),
        )

        // 基线值
        baselineSQL := fmt.Sprintf(
            "SELECT %s / 7.0 AS value FROM %s WHERE %s",
            aggExpr, m.BaseTable,
            s.buildBaselineTimeFilter(ds.Type, m.BaseTable, 7),
        )

        currentRows, err1 := s.dataSourceService.ExecuteQuery(ds, currentSQL)
        baselineRows, err2 := s.dataSourceService.ExecuteQuery(ds, baselineSQL)

        if err1 != nil || err2 != nil || len(currentRows) == 0 || len(baselineRows) == 0 {
            continue
        }

        currentVal, _ := toFloat64Safe(currentRows[0]["value"])
        baselineVal, _ := toFloat64Safe(baselineRows[0]["value"])

        changePct := 0.0
        if baselineVal != 0 {
            changePct = ((currentVal - baselineVal) / baselineVal) * 100
        }

        direction := "up"
        if currentVal < baselineVal {
            direction = "down"
        }

        results = append(results, CorrelatedAnomaly{
            MetricID:      m.ID,
            MetricName:    m.DisplayName,
            CurrentValue:  math.Round(currentVal*100) / 100,
            BaselineValue: math.Round(baselineVal*100) / 100,
            ChangePct:     math.Round(changePct*100) / 100,
            IsAnomaly:     math.Abs(changePct) > 20,
            Direction:     direction,
        })
    }

    return results
}
```

#### 2.3.6 置信度增强计算

```go
func (s *RootCauseService) calculateEnhancedConfidence(result *RootCauseResult) float64 {
    base := s.calculateConfidence(result) // 已有的基础计算

    // 关联指标增强
    anomalyCount := 0
    sameDirectionCount := 0
    primaryDirection := ""
    if len(result.TopFactors) > 0 {
        primaryDirection = result.TopFactors[0].Direction
    }

    for _, ca := range result.CorrelatedAnomalies {
        if ca.IsAnomaly {
            anomalyCount++
            if ca.Direction == primaryDirection {
                sameDirectionCount++
            }
        }
    }

    if anomalyCount >= 2 {
        base += 0.1
    }
    if sameDirectionCount >= 2 {
        base += 0.05
    }

    if base > 1.0 {
        base = 1.0
    }

    return math.Round(base*100) / 100
}
```

---

### 2.4 DailySummaryService 增强 (REQ-W2-003, REQ-W2-008 ~ REQ-W2-010)

#### 2.4.1 新增依赖

```go
type DailySummaryService struct {
    db                *gorm.DB
    anomalyService    *AnomalyService
    imService         *IMService
    metricService     *MetricService
    dataSourceService *DataSourceService
}
```

#### 2.4.2 增强的数据结构

```go
// SummaryContent 增强版摘要内容
type SummaryContent struct {
    HealthScore int               `json:"healthScore"`
    Metrics     []MetricSummary   `json:"metrics"`
    Anomalies   []AnomalySummary  `json:"anomalies"`
    Trends      []string          `json:"trends"`
    Predictions []MetricPrediction `json:"predictions"`
    Concerns    []ConcernItem     `json:"concerns"`
    Positives   []PositiveItem    `json:"positives"`
}

// MetricSummary 增强
type MetricSummary struct {
    Name         string    `json:"name"`
    DisplayName  string    `json:"displayName"`
    CurrentValue float64   `json:"currentValue"`
    Unit         string    `json:"unit"`
    Format       string    `json:"format"`
    DayChange    float64   `json:"dayChange"`    // 环比（日）
    WeekChange   float64   `json:"weekChange"`   // 环比（周）
    YoYChange    float64   `json:"yoyChange"`    // 同比
    Direction    string    `json:"direction"`     // up/down/stable
    Sparkline    []float64 `json:"sparkline"`     // 最近 7 天微型趋势
}

// MetricPrediction 趋势预测
type MetricPrediction struct {
    MetricName       string  `json:"metricName"`
    CurrentValue     float64 `json:"currentValue"`
    PredictedValue3d float64 `json:"predictedValue3d"` // 3 天后预测值
    PredictedWeek    float64 `json:"predictedWeek"`    // 本周预测总量
    Confidence       float64 `json:"confidence"`       // R-squared
    Trend            string  `json:"trend"`            // rising/falling/flat
    Note             string  `json:"note"`             // 置信度低时的备注
}

// ConcernItem 需要关注的项
type ConcernItem struct {
    Title      string `json:"title"`
    Analysis   string `json:"analysis"`
    Suggestion string `json:"suggestion"`
    Severity   string `json:"severity"` // warning/critical
}

// PositiveItem 正面趋势
type PositiveItem struct {
    Title      string `json:"title"`
    Analysis   string `json:"analysis"`
    Suggestion string `json:"suggestion"`
}
```

#### 2.4.3 核心指标查询实现

```go
func (s *DailySummaryService) queryMetricSummaries(tenantID string) []MetricSummary {
    // 1. 获取核心指标
    metrics := s.getCoreMetrics(tenantID)
    if len(metrics) == 0 {
        return nil
    }

    var summaries []MetricSummary
    for _, metric := range metrics {
        summary := s.queryMetricData(tenantID, &metric)
        if summary != nil {
            summaries = append(summaries, *summary)
        }
    }
    return summaries
}

func (s *DailySummaryService) queryMetricData(tenantID string, metric *model.Metric) *MetricSummary {
    ds, err := s.findDataSource(tenantID, metric)
    if err != nil {
        return nil
    }

    timeField := s.resolveTimeField(tenantID, metric, ds)
    aggExpr := buildAggExpression(metric)
    today := time.Now()

    // 查询当日、昨日、上周同日
    todayVal := s.queryAggValue(ds, aggExpr, metric.BaseTable, timeField,
        today.Format("2006-01-02"), today.AddDate(0, 0, 1).Format("2006-01-02"))
    yesterdayVal := s.queryAggValue(ds, aggExpr, metric.BaseTable, timeField,
        today.AddDate(0, 0, -1).Format("2006-01-02"), today.Format("2006-01-02"))
    lastWeekVal := s.queryAggValue(ds, aggExpr, metric.BaseTable, timeField,
        today.AddDate(0, 0, -7).Format("2006-01-02"), today.AddDate(0, 0, -6).Format("2006-01-02"))

    // 查询最近 7 天微型趋势
    sparkline := s.querySparkline(ds, aggExpr, metric.BaseTable, timeField, 7)

    dayChange := calcChangePercent(todayVal, yesterdayVal)
    yoyChange := calcChangePercent(todayVal, lastWeekVal)

    direction := "stable"
    if dayChange > 1 {
        direction = "up"
    } else if dayChange < -1 {
        direction = "down"
    }

    unit := s.getMetricUnit(metric)

    return &MetricSummary{
        Name:         metric.Name,
        DisplayName:  metric.DisplayName,
        CurrentValue: math.Round(todayVal*100) / 100,
        Unit:         unit,
        DayChange:    math.Round(dayChange*100) / 100,
        YoYChange:    math.Round(yoyChange*100) / 100,
        Direction:    direction,
        Sparkline:    sparkline,
    }
}
```

#### 2.4.4 线性回归趋势预测

```go
func (s *DailySummaryService) predictTrends(metrics []MetricSummary) []MetricPrediction {
    var predictions []MetricPrediction

    for _, m := range metrics {
        if len(m.Sparkline) < 3 {
            continue // 数据不足不预测
        }

        // 线性回归 y = a + b*x
        n := float64(len(m.Sparkline))
        sumX, sumY, sumXY, sumX2 := 0.0, 0.0, 0.0, 0.0
        for i, v := range m.Sparkline {
            x := float64(i)
            sumX += x
            sumY += v
            sumXY += x * v
            sumX2 += x * x
        }

        denominator := n*sumX2 - sumX*sumX
        if denominator == 0 {
            continue
        }

        b := (n*sumXY - sumX*sumY) / denominator
        a := (sumY - b*sumX) / n

        // R-squared
        meanY := sumY / n
        ssTot, ssRes := 0.0, 0.0
        for i, v := range m.Sparkline {
            predicted := a + b*float64(i)
            ssTot += math.Pow(v-meanY, 2)
            ssRes += math.Pow(v-predicted, 2)
        }
        rSquared := 0.0
        if ssTot > 0 {
            rSquared = 1 - ssRes/ssTot
        }

        // 预测 3 天后
        predictedValue3d := a + b*float64(len(m.Sparkline)+2)

        trend := "flat"
        if b > 0 {
            trend = "rising"
        } else if b < 0 {
            trend = "falling"
        }

        note := ""
        if rSquared < 0.5 {
            note = "趋势不明显，预测仅供参考"
        }

        predictions = append(predictions, MetricPrediction{
            MetricName:       m.DisplayName,
            CurrentValue:     m.CurrentValue,
            PredictedValue3d: math.Round(predictedValue3d*100) / 100,
            Confidence:       math.Round(rSquared*100) / 100,
            Trend:            trend,
            Note:             note,
        })
    }

    return predictions
}
```

#### 2.4.5 正负面趋势分类

```go
func (s *DailySummaryService) classifyTrends(
    metrics []MetricSummary,
    anomalies []model.AnomalyEvent,
) ([]ConcernItem, []PositiveItem) {
    var concerns []ConcernItem
    var positives []PositiveItem

    for _, m := range metrics {
        // 负面趋势
        if m.DayChange < -5 {
            concerns = append(concerns, ConcernItem{
                Title:      fmt.Sprintf("%s 环比下降 %.1f%%", m.DisplayName, math.Abs(m.DayChange)),
                Analysis:   s.generateConcernAnalysis(m),
                Suggestion: s.generateConcernSuggestion(m),
                Severity:   s.classifySeverity(m.DayChange),
            })
        }

        // 检测连续下滑（sparkline 最后 3 个点递减）
        if isConsecutiveDecline(m.Sparkline, 3) {
            concerns = append(concerns, ConcernItem{
                Title:      fmt.Sprintf("%s 连续 3 天下滑（当前 %.0f）", m.DisplayName, m.CurrentValue),
                Analysis:   fmt.Sprintf("最近 3 天分别为 %.0f -> %.0f -> %.0f", m.Sparkline[len(m.Sparkline)-3], m.Sparkline[len(m.Sparkline)-2], m.Sparkline[len(m.Sparkline)-1]),
                Suggestion: fmt.Sprintf("建议关注 %s 下滑原因", m.DisplayName),
                Severity:   "warning",
            })
        }

        // 正面趋势
        if m.DayChange > 10 {
            positives = append(positives, PositiveItem{
                Title:      fmt.Sprintf("%s 环比增长 %.1f%%", m.DisplayName, m.DayChange),
                Analysis:   s.generatePositiveAnalysis(m),
                Suggestion: "保持关注，持续追踪增长来源",
            })
        }
    }

    return concerns, positives
}
```

#### 2.4.6 IM 推送增强

```go
func (s *DailySummaryService) buildEnhancedMessage(content *SummaryContent, date string) string {
    var sb strings.Builder

    sb.WriteString(fmt.Sprintf("BizLens 每日业务摘要\n日期：%s\n\n", date))
    sb.WriteString(fmt.Sprintf("[健康评分] %d/100\n\n", content.HealthScore))

    // 核心指标速览
    if len(content.Metrics) > 0 {
        sb.WriteString("[核心指标速览]\n")
        for _, m := range content.Metrics {
            changeSymbol := "+"
            if m.DayChange < 0 {
                changeSymbol = ""
            }
            sb.WriteString(fmt.Sprintf("  %s: %s%.0f  环比 %s%.1f%%\n",
                m.DisplayName, m.Unit, m.CurrentValue,
                changeSymbol, m.DayChange))
        }
        sb.WriteString("\n")
    }

    // 需要关注
    if len(content.Concerns) > 0 {
        sb.WriteString(fmt.Sprintf("[需要关注] %d 项\n", len(content.Concerns)))
        for i, c := range content.Concerns {
            sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, c.Title))
            if c.Analysis != "" {
                sb.WriteString(fmt.Sprintf("     -> %s\n", c.Analysis))
            }
            if c.Suggestion != "" {
                sb.WriteString(fmt.Sprintf("     -> 建议：%s\n", c.Suggestion))
            }
        }
        sb.WriteString("\n")
    }

    // 正面趋势
    if len(content.Positives) > 0 {
        sb.WriteString(fmt.Sprintf("[正面趋势] %d 项\n", len(content.Positives)))
        for i, p := range content.Positives {
            sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, p.Title))
        }
        sb.WriteString("\n")
    }

    // 趋势预测
    if len(content.Predictions) > 0 {
        sb.WriteString("[趋势预测]\n")
        for _, p := range content.Predictions {
            sb.WriteString(fmt.Sprintf("  %s: 预计 3 天后 %.0f（趋势：%s）\n",
                p.MetricName, p.PredictedValue3d, p.Trend))
            if p.Note != "" {
                sb.WriteString(fmt.Sprintf("  注：%s\n", p.Note))
            }
        }
    }

    return sb.String()
}
```

---

### 2.5 公共辅助函数抽取

多个服务需要共用的函数应抽取到公共位置：

```go
// backend/internal/service/query_helpers.go

// buildAggExpression 构建聚合表达式
func buildAggExpression(metric *model.Metric) string {
    switch metric.Aggregation {
    case model.AggSum:
        return fmt.Sprintf("SUM(%s)", metric.BaseField)
    case model.AggCount:
        return fmt.Sprintf("COUNT(%s)", metric.BaseField)
    case model.AggAvg:
        return fmt.Sprintf("AVG(%s)", metric.BaseField)
    case model.AggMin:
        return fmt.Sprintf("MIN(%s)", metric.BaseField)
    case model.AggMax:
        return fmt.Sprintf("MAX(%s)", metric.BaseField)
    case model.AggDistinct:
        return fmt.Sprintf("COUNT(DISTINCT %s)", metric.BaseField)
    default:
        return fmt.Sprintf("SUM(%s)", metric.BaseField)
    }
}

// toFloat64Safe 安全转换数值
func toFloat64Safe(v interface{}) (float64, bool) { ... }

// calcChangePercent 计算变化百分比
func calcChangePercent(current, previous float64) float64 {
    if previous == 0 {
        return 0
    }
    return ((current - previous) / previous) * 100
}

// isConsecutiveDecline 检测连续下滑
func isConsecutiveDecline(values []float64, n int) bool {
    if len(values) < n {
        return false
    }
    tail := values[len(values)-n:]
    for i := 1; i < len(tail); i++ {
        if tail[i] >= tail[i-1] {
            return false
        }
    }
    return true
}
```

---

## 三、初始化链路改造

### 3.1 main.go 服务初始化顺序

```go
// 1. 基础服务
dataSourceService := service.NewDataSourceService(db)
metricService := service.NewMetricService(db)
imService := service.NewIMService(db)

// 2. 业务监控服务（需要依赖注入数据源和指标服务）
baselineService := service.NewBaselineService(db, metricService, dataSourceService)
anomalyService := service.NewAnomalyService(db, baselineService, imService)
rootCauseService := service.NewRootCauseService(db, dataSourceService, metricService)
anomalyService.SetRootCauseService(rootCauseService)

dailySummaryService := service.NewDailySummaryService(db, anomalyService, imService, metricService, dataSourceService)
schedulerService := service.NewSchedulerService(db, baselineService, anomalyService, dailySummaryService, metricService, dataSourceService, imService)

// 3. Handler
anomalyHandler := handler.NewAnomalyHandler(anomalyService, rootCauseService)
dailySummaryHandler := handler.NewDailySummaryHandler(dailySummaryService)
```

---

## 四、SQL 方言兼容矩阵

| 操作 | PostgreSQL | MySQL | SQLite |
|------|-----------|-------|--------|
| 日期截断 | `date_trunc('day', col)` | `DATE(col)` | `date(col)` |
| 小时截断 | `date_trunc('hour', col)` | `DATE_FORMAT(col, '%Y-%m-%d %H:00:00')` | `strftime('%Y-%m-%d %H:00:00', col)` |
| 周截断 | `date_trunc('week', col)` | `DATE(DATE_SUB(col, INTERVAL WEEKDAY(col) DAY))` | `date(col, 'weekday 0', '-6 days')` |
| 日期比较 | `col >= '2026-03-25'` | `col >= '2026-03-25'` | `col >= '2026-03-25'` |
| 标识符引用 | `"col"` | `` `col` `` | `"col"` |

---

## 五、测试策略

### 5.1 单元测试

| 测试项 | 文件 | 说明 |
|--------|------|------|
| 线性回归算法 | `daily_summary_service_test.go` | 已知数据集验证 slope/intercept/R^2 |
| 拐点检测算法 | `root_cause_service_test.go` | 给定时间序列验证拐点位置 |
| 连续下滑检测 | `query_helpers_test.go` | 各种数组场景 |
| 时间分组 SQL 生成 | `baseline_service_test.go` | 三种方言的 SQL 格式 |

### 5.2 集成测试

| 测试项 | 说明 |
|--------|------|
| 端到端监控流程 | SQLite + 种子数据 -> 基线学习 -> 异常检测 -> 根因分析 -> 摘要生成 |
| 多租户并发 | 3 个租户并发执行调度任务 |
| 数据源不可用降级 | 模拟数据源连接失败，验证优雅降级 |

---

## 六、风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|------|---------|
| 用户数据源无标准时间字段 | 高 | 多级回退策略：语义层 -> 常见命名 -> 手动配置 |
| 交叉下钻查询量过大 | 中 | 严格限制：仅 Top1 因子 + 最多 3 个次维度 + LIMIT 10 |
| 线性回归对非线性趋势预测不准 | 中 | R^2 < 0.5 时明确标注，后续版本可升级为 ARIMA |
| 关联指标查询数据源压力 | 低 | 最多查询 5 个关联指标，超时 10 秒 |
