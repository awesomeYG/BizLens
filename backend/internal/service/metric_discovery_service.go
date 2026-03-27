package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"ai-bi-server/internal/model"
	"github.com/google/uuid"
)

// MetricDiscoveryService 智能指标发现服务
// 核心能力：基于数据库 schema 和已有 AI 分析结果，通过规则推断关键业务指标
type MetricDiscoveryService struct {
	dataSourceService *DataSourceService
	llmService        *LLMService
	aiConfigService   *AIConfigService
}

// NewMetricDiscoveryService 创建智能指标发现服务
func NewMetricDiscoveryService(
	dataSourceService *DataSourceService,
	llmService *LLMService,
	aiConfigService *AIConfigService,
) *MetricDiscoveryService {
	return &MetricDiscoveryService{
		dataSourceService: dataSourceService,
		llmService:        llmService,
		aiConfigService:   aiConfigService,
	}
}

// KeyMetricRecommendation 关键指标推荐
type KeyMetricRecommendation struct {
	Table        string   `json:"table"`
	Field        string   `json:"field"`
	DisplayName  string   `json:"displayName"`
	MetricName   string   `json:"metricName"`
	DataType     string   `json:"dataType"`
	Aggregation  string   `json:"aggregation"`
	Formula      string   `json:"formula,omitempty"`
	Confidence   float64  `json:"confidence"`
	Reason       string   `json:"reason"`
	IsComposite  bool     `json:"isComposite"`
	Dependencies []string `json:"dependencies,omitempty"`
	Category     string   `json:"category"`
}

// DiscoverContext 发现上下文状态
type DiscoverContext struct {
	SchemaAnalyzed  bool     `json:"schemaAnalyzed"`
	AnalysisModel   string   `json:"analysisModel,omitempty"`
	AnalyzedAt      string   `json:"analyzedAt,omitempty"`
	TableCount      int      `json:"tableCount"`
	AvailableTables []string `json:"availableTables"`
	HasAIAnalysis   bool     `json:"hasAIAnalysis"`
}

// SmartRecommendResponse 智能推荐响应
type SmartRecommendResponse struct {
	Recommendations []KeyMetricRecommendation            `json:"recommendations"`
	TotalCount      int                                  `json:"totalCount"`
	ByCategory      map[string][]KeyMetricRecommendation `json:"byCategory,omitempty"`
}

// GetDiscoverContext 获取发现上下文状态
func (s *MetricDiscoveryService) GetDiscoverContext(tenantID, dataSourceID string) (*DiscoverContext, error) {
	ds, err := s.dataSourceService.GetDataSource(dataSourceID, tenantID)
	if err != nil {
		return nil, err
	}

	ctx := &DiscoverContext{
		SchemaAnalyzed:  false,
		HasAIAnalysis:   false,
		AvailableTables: []string{},
	}

	if ds.SchemaInfo == "" {
		return ctx, nil
	}

	// 解析 schema 获取表列表
	var schemaInfo map[string]interface{}
	if err := json.Unmarshal([]byte(ds.SchemaInfo), &schemaInfo); err != nil {
		return ctx, nil
	}

	tables, _ := schemaInfo["tables"].([]interface{})
	for _, t := range tables {
		if name, ok := t.(string); ok {
			ctx.AvailableTables = append(ctx.AvailableTables, name)
		}
	}
	ctx.TableCount = len(ctx.AvailableTables)
	ctx.SchemaAnalyzed = ctx.TableCount > 0

	// 解析 AI 分析结果
	if ds.AIAnalysis != "" {
		var analysis model.SchemaAIAnalysis
		if err := json.Unmarshal([]byte(ds.AIAnalysis), &analysis); err == nil && analysis.AnalyzedAt != "" {
			ctx.SchemaAnalyzed = true
			ctx.HasAIAnalysis = true
			ctx.AnalysisModel = analysis.ModelUsed
			ctx.AnalyzedAt = analysis.AnalyzedAt
		}
	}

	return ctx, nil
}

// SmartRecommend 智能推荐关键指标
// 核心思路：
//  1. 优先使用 AI 已有的 Recommendations（字段级指标，如 SUM(amount)）
//  2. 基于 AI 的 Fields 语义分析，智能推断复合指标（DAU、转化率、客单价等）
//  3. 规则兜底，补充通用数值字段
//
// 全程无需额外 LLM 调用，完全复用已有分析结果
func (s *MetricDiscoveryService) SmartRecommend(tenantID, dataSourceID string) (*SmartRecommendResponse, error) {
	ds, err := s.dataSourceService.GetDataSource(dataSourceID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("获取数据源失败: %w", err)
	}

	if ds.SchemaInfo == "" {
		return nil, fmt.Errorf("数据源未同步表结构，请先在数据源设置中保存/同步表结构")
	}

	// 解析 schema 信息
	var schemaInfo map[string]interface{}
	if err := json.Unmarshal([]byte(ds.SchemaInfo), &schemaInfo); err != nil {
		return nil, fmt.Errorf("解析 schema 失败: %w", err)
	}

	// 解析已有的 AI 分析结果（AI 已经分析过 schema，结果存在这里）
	var aiAnalysis *model.SchemaAIAnalysis
	if ds.AIAnalysis != "" {
		var parsed model.SchemaAIAnalysis
		if err := json.Unmarshal([]byte(ds.AIAnalysis), &parsed); err == nil && parsed.AnalyzedAt != "" {
			aiAnalysis = &parsed
		}
	}

	// 构建表和字段的索引
	fieldIndex := buildFieldIndex(schemaInfo)
	tableList := getTableList(schemaInfo)

	// 第一步：使用 AI 分析推荐的字段级指标
	recommendations := s.useAIRecommendations(aiAnalysis)

	// 第二步：基于 AI 语义分析，智能推断复合指标
	compositeRecs := s.inferCompositesFromAIAnalysis(tableList, fieldIndex, aiAnalysis)
	recommendations = append(recommendations, compositeRecs...)

	// 第三步：规则兜底——补充 AI 没发现但可能有价值的通用数值字段
	// （在 schema 未被 AI 分析的情况下使用）
	if aiAnalysis == nil || len(aiAnalysis.Fields) == 0 {
		fallbackRecs := s.inferKeyMetrics(tableList, fieldIndex, aiAnalysis)
		recommendations = append(recommendations, fallbackRecs...)
	}

	// 按类别分组
	byCategory := make(map[string][]KeyMetricRecommendation)
	for _, rec := range recommendations {
		cat := rec.Category
		if cat == "" {
			cat = "其他"
		}
		byCategory[cat] = append(byCategory[cat], rec)
	}

	return &SmartRecommendResponse{
		Recommendations: recommendations,
		TotalCount:      len(recommendations),
		ByCategory:      byCategory,
	}, nil
}

// fieldInfo 字段信息
type fieldInfo struct {
	table   string
	name    string
	colType string
}

// buildFieldIndex 构建字段索引
func buildFieldIndex(schemaInfo map[string]interface{}) map[string][]fieldInfo {
	index := make(map[string][]fieldInfo)
	structure, _ := schemaInfo["structure"].(map[string]interface{})

	for tableName, cols := range structure {
		colList, ok := cols.([]interface{})
		if !ok {
			continue
		}
		for _, c := range colList {
			col, ok := c.(map[string]interface{})
			if !ok {
				continue
			}
			field, _ := col["field"].(string)
			colType, _ := col["type"].(string)
			if field != "" {
				index[tableName] = append(index[tableName], fieldInfo{
					table:   tableName,
					name:    field,
					colType: colType,
				})
			}
		}
	}
	return index
}

// getTableList 获取表列表
func getTableList(schemaInfo map[string]interface{}) []string {
	tables, _ := schemaInfo["tables"].([]interface{})
	result := make([]string, 0, len(tables))
	for _, t := range tables {
		if name, ok := t.(string); ok {
			result = append(result, name)
		}
	}
	return result
}

// useAIRecommendations 直接使用 AI 分析已有的 Recommendations
// AI 已经分析过 schema，这些推荐是基于语义理解的，比规则更准确
func (s *MetricDiscoveryService) useAIRecommendations(aiAnalysis *model.SchemaAIAnalysis) []KeyMetricRecommendation {
	if aiAnalysis == nil || len(aiAnalysis.Recommendations) == 0 {
		return nil
	}

	recs := []KeyMetricRecommendation{}
	for _, rec := range aiAnalysis.Recommendations {
		dataType := "number"
		if rec.DataType == "currency" {
			dataType = "currency"
		} else if rec.DataType == "ratio" {
			dataType = "percentage"
		}

		formula := rec.Formula
		if formula == "" && rec.Table != "" && rec.Field != "" {
			formula = fmt.Sprintf("%s(%s.%s)", strings.ToUpper(rec.Aggregation), rec.Table, rec.Field)
		}

		recs = append(recs, KeyMetricRecommendation{
			Table:        rec.Table,
			Field:        rec.Field,
			DisplayName:  rec.DisplayName,
			MetricName:   toSnakeCase(rec.DisplayName),
			DataType:     dataType,
			Aggregation:  strings.ToUpper(rec.Aggregation),
			Formula:      formula,
			Confidence:   rec.Confidence,
			Reason:       fmt.Sprintf("AI 分析推荐（置信度 %.0f%%）：%s", rec.Confidence*100, rec.Reason),
			IsComposite:  rec.IsComposite,
			Dependencies: rec.Dependencies,
			Category:     inferCategory(rec.Table, rec.Field),
		})
	}
	return recs
}

// inferCompositesFromAIAnalysis 基于 AI 语义分析，智能推断复合指标
// 核心：不再依赖字段名匹配，而是基于 AI 标记的语义类型（time、metric、identifier）来推断
// 例如：AI 标记了 users.created_at=time、users.user_id=identifier
// → 就能推断出"新增注册用户数"（不需要字段名叫 created_at）
func (s *MetricDiscoveryService) inferCompositesFromAIAnalysis(
	tables []string,
	fieldIndex map[string][]fieldInfo,
	aiAnalysis *model.SchemaAIAnalysis,
) []KeyMetricRecommendation {
	if aiAnalysis == nil || len(aiAnalysis.Fields) == 0 {
		return nil
	}

	recs := []KeyMetricRecommendation{}
	seen := make(map[string]bool)

	// 构建 AI 语义索引：table -> field -> FieldSemanticAI
	aiFieldIndex := make(map[string]map[string]model.FieldSemanticAI)
	for _, f := range aiAnalysis.Fields {
		if aiFieldIndex[f.Table] == nil {
			aiFieldIndex[f.Table] = make(map[string]model.FieldSemanticAI)
		}
		aiFieldIndex[f.Table][f.Field] = f
	}

	// 识别业务表类型
	var userTables []string              // 有 time 字段的用户表
	var orderTables []string             // 有 amount/user_id 的交易表
	var amountFields map[string][]string // table -> amount 字段列表

	amountFields = make(map[string][]string)
	for _, t := range tables {
		fields := fieldIndex[t]
		aiFields := aiFieldIndex[t]

		hasTime := false
		hasAmount := false

		for _, f := range fields {
			if aiFields != nil {
				semantic := aiFields[f.name]
				switch semantic.SemanticType {
				case "time":
					hasTime = true
				case "identifier":
					// 识别用户相关的 identifier
					_ = strings.Contains(strings.ToLower(f.name), "user") ||
						strings.Contains(strings.ToLower(f.name), "customer") ||
						strings.Contains(strings.ToLower(f.name), "member")
				case "metric":
					lower := strings.ToLower(f.name)
					if containsAny(lower, "amount", "price", "total", "revenue", "quantity") {
						hasAmount = true
						amountFields[t] = append(amountFields[t], f.name)
					}
				}
			}
		}

		// 推断表类型
		lowerT := strings.ToLower(t)
		if containsAny(lowerT, "user", "member", "customer", "account") && hasTime {
			userTables = append(userTables, t)
		}
		if containsAny(lowerT, "order", "transaction", "trade") && hasAmount {
			orderTables = append(orderTables, t)
		}
	}

	// 推断用户类复合指标
	for _, ut := range userTables {
		aiFields := aiFieldIndex[ut]
		if aiFields == nil {
			continue
		}

		// 找时间字段
		var timeField string
		var userIdField string
		for fname, f := range aiFields {
			if f.SemanticType == "time" && timeField == "" {
				timeField = fname
			}
			if f.SemanticType == "identifier" && strings.Contains(strings.ToLower(fname), "user") {
				userIdField = fname
			}
		}
		if userIdField == "" {
			userIdField = findField(fieldIndex[ut], "user_id", "id", "uid")
		}

		// 新增注册用户数（只要有 time 字段 + user 相关的 identifier）
		if timeField != "" && userIdField != "" {
			key := "新增注册用户数"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        ut,
					Field:        userIdField,
					DisplayName:  "新增注册用户数",
					MetricName:   "daily_new_users",
					DataType:     "number",
					Aggregation:  "COUNT",
					Formula:      fmt.Sprintf("COUNT(DISTINCT %s.%s)", ut, userIdField),
					Confidence:   0.85,
					Reason:       "AI 分析识别该表为用户表，包含时间维度和用户标识，可按日/周/月统计新增用户",
					IsComposite:  false,
					Dependencies: []string{fmt.Sprintf("%s.%s", ut, timeField), fmt.Sprintf("%s.%s", ut, userIdField)},
					Category:     "用户",
				})
			}
		}
	}

	// 推断交易类复合指标
	for _, ot := range orderTables {
		amounts := amountFields[ot]
		if len(amounts) == 0 {
			continue
		}
		amountField := amounts[0]

		// 客单价 = SUM(amount) / COUNT(DISTINCT user_id)
		aiFields := aiFieldIndex[ot]
		var userIdField string
		if aiFields != nil {
			for fname, f := range aiFields {
				if f.SemanticType == "identifier" && strings.Contains(strings.ToLower(fname), "user") {
					userIdField = fname
					break
				}
			}
		}
		if userIdField == "" {
			// 从 userTables 找
			for _, ut := range userTables {
				uid := findField(fieldIndex[ut], "user_id", "id")
				if uid != "" {
					userIdField = uid
					break
				}
			}
		}

		if userIdField != "" {
			// 客单价
			key := "客单价"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        ot,
					Field:        "",
					DisplayName:  "客单价",
					MetricName:   "avg_order_value",
					DataType:     "currency",
					Aggregation:  "COMPOSITE",
					Formula:      fmt.Sprintf("SUM(%s.%s) / NULLIF(COUNT(DISTINCT %s.%s), 0)", ot, amountField, ot, userIdField),
					Confidence:   0.8,
					Reason:       "AI 识别到交易表有金额字段和用户标识，可计算平均每笔订单金额",
					IsComposite:  true,
					Dependencies: []string{fmt.Sprintf("%s.%s", ot, amountField), fmt.Sprintf("%s.%s", ot, userIdField)},
					Category:     "交易",
				})
			}
		}

		// 转化率：从 userTables 到 orderTables
		for _, ut := range userTables {
			uid := findField(fieldIndex[ut], "user_id", "id")
			orderId := findField(fieldIndex[ot], "order_id", "id")
			if uid != "" && orderId != "" {
				key := "下单转化率"
				if !seen[key] {
					seen[key] = true
					recs = append(recs, KeyMetricRecommendation{
						Table:        "",
						Field:        "",
						DisplayName:  "下单转化率",
						MetricName:   "order_conversion_rate",
						DataType:     "percentage",
						Aggregation:  "COMPOSITE",
						Formula:      fmt.Sprintf("COUNT(DISTINCT %s.%s) / NULLIF(COUNT(DISTINCT %s.%s), 0) * 100", ot, orderId, ut, uid),
						Confidence:   0.7,
						Reason:       "AI 识别到用户表和交易表关联，可计算有下单行为的用户占比",
						IsComposite:  true,
						Dependencies: []string{fmt.Sprintf("%s.%s", ut, uid), fmt.Sprintf("%s.%s", ot, orderId)},
						Category:     "交易",
					})
				}
				break // 只需一个
			}
		}
	}

	// 补充：AI 发现的金额类指标但不在 Recommendations 中的
	for _, t := range tables {
		aiFields := aiFieldIndex[t]
		if aiFields == nil {
			continue
		}
		for fname, f := range aiFields {
			if f.SemanticType == "metric" && !containsAny(strings.ToLower(fname), "id") {
				lower := strings.ToLower(fname)
				if containsAny(lower, "amount", "price", "total", "revenue", "quantity", "cost") {
					key := f.BusinessName
					if key == "" {
						key = fname
					}
					if seen[key] {
						continue
					}
					seen[key] = true

					dataType := "number"
					if containsAny(lower, "amount", "price", "revenue", "cost", "total") {
						dataType = "currency"
					}

					recs = append(recs, KeyMetricRecommendation{
						Table:        t,
						Field:        fname,
						DisplayName:  f.BusinessName,
						MetricName:   toSnakeCase(f.BusinessName),
						DataType:     dataType,
						Aggregation:  strings.ToUpper(f.Aggregation),
						Formula:      fmt.Sprintf("%s(%s.%s)", strings.ToUpper(f.Aggregation), t, fname),
						Confidence:   f.Confidence,
						Reason:       fmt.Sprintf("AI 语义识别为 %s（置信度 %.0f%%）：%s", f.SemanticType, f.Confidence*100, f.Reason),
						IsComposite:  false,
						Dependencies: []string{fmt.Sprintf("%s.%s", t, fname)},
						Category:     inferCategory(t, fname),
					})
				}
			}
		}
	}

	return recs
}

// inferKeyMetrics 基于规则推断关键指标（兜底方案）
func (s *MetricDiscoveryService) inferKeyMetrics(
	tables []string,
	fieldIndex map[string][]fieldInfo,
	aiAnalysis *model.SchemaAIAnalysis,
) []KeyMetricRecommendation {
	recs := []KeyMetricRecommendation{}
	seen := make(map[string]bool)

	// 分类表和字段
	var userTables []string    // 用户表
	var orderTables []string   // 订单/交易表
	var paymentTables []string // 支付表
	var productTables []string // 商品表
	var refundTables []string  // 退款表
	var otherTables []string   // 其他表

	for _, t := range tables {
		lower := strings.ToLower(t)
		switch {
		case containsAny(lower, "user", "member", "customer", "account"):
			userTables = append(userTables, t)
		case containsAny(lower, "order", "transaction", "trade"):
			orderTables = append(orderTables, t)
		case containsAny(lower, "payment", "pay", "invoice"):
			paymentTables = append(paymentTables, t)
		case containsAny(lower, "product", "item", "sku", "goods"):
			productTables = append(productTables, t)
		case containsAny(lower, "refund", "return"):
			refundTables = append(refundTables, t)
		default:
			otherTables = append(otherTables, t)
		}
	}

	// ========== 用户类指标 ==========
	for _, ut := range userTables {
		fields := fieldIndex[ut]
		hasCreatedAt := hasField(fields, "created_at", "registered_at", "注册时间", "注册日期")
		hasUserId := hasField(fields, "user_id", "id")
		_ = hasField(fields, "status", "state") // 预留给状态过滤用

		// 新增注册用户数
		if hasCreatedAt && hasUserId {
			key := "新增注册用户数"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        ut,
					Field:        "user_id",
					DisplayName:  "新增注册用户数",
					MetricName:   "daily_new_users",
					DataType:     "number",
					Aggregation:  "COUNT",
					Formula:      fmt.Sprintf("COUNT(DISTINCT %s.%s)", ut, findField(fields, "user_id", "id")),
					Confidence:   0.9,
					Reason:       "用户表包含注册时间字段，可按日/周/月统计新增用户数，是衡量产品增长的核心指标",
					IsComposite:  false,
					Dependencies: []string{fmt.Sprintf("%s.user_id", ut), fmt.Sprintf("%s.created_at", ut)},
					Category:     "用户",
				})
			}
		}

		// 总用户数
		if hasUserId {
			key := "总用户数"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:       ut,
					Field:       "user_id",
					DisplayName: "总用户数",
					MetricName:  "total_users",
					DataType:    "number",
					Aggregation: "COUNT",
					Formula:     fmt.Sprintf("COUNT(DISTINCT %s.%s)", ut, findField(fields, "user_id", "id")),
					Confidence:  0.95,
					Reason:      "用户表主键去重计数，衡量产品用户规模",
					IsComposite: false,
					Category:    "用户",
				})
			}
		}

		// 用户留存率（如果有活跃表）
		for _, ot := range orderTables {
			if hasField(fieldIndex[ot], "user_id") && hasCreatedAt {
				key := "用户复购率"
				if !seen[key] {
					seen[key] = true
					recs = append(recs, KeyMetricRecommendation{
						Table:        ut,
						Field:        "",
						DisplayName:  "用户复购率",
						MetricName:   "repurchase_rate",
						DataType:     "percentage",
						Aggregation:  "COMPOSITE",
						Formula:      fmt.Sprintf("COUNT(DISTINCT %s.user_id) / NULLIF(COUNT(DISTINCT %s.user_id), 0) * 100", ot, ut),
						Confidence:   0.7,
						Reason:       "有过购买行为的用户 / 总用户数 * 100，衡量用户价值的重要指标",
						IsComposite:  true,
						Dependencies: []string{fmt.Sprintf("%s.user_id", ut), fmt.Sprintf("%s.user_id", ot)},
						Category:     "用户",
					})
				}
			}
		}
	}

	// ========== 交易类指标 ==========
	for _, ot := range orderTables {
		fields := fieldIndex[ot]
		hasAmount := getAmountField(fields)
		hasUserId := hasField(fields, "user_id")
		hasOrderId := hasField(fields, "order_id", "id")

		// GMV / 订单总额
		if hasAmount != "" {
			key := "GMV"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        ot,
					Field:        hasAmount,
					DisplayName:  "GMV",
					MetricName:   "gmv",
					DataType:     "currency",
					Aggregation:  "SUM",
					Formula:      fmt.Sprintf("SUM(%s.%s)", ot, hasAmount),
					Confidence:   0.9,
					Reason:       "订单金额求和，衡量交易规模的核心指标",
					IsComposite:  false,
					Dependencies: []string{fmt.Sprintf("%s.%s", ot, hasAmount)},
					Category:     "交易",
				})
			}
		}

		// 订单数
		if hasOrderId {
			key := "订单数"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:       ot,
					Field:       findField(fields, "order_id", "id"),
					DisplayName: "订单数",
					MetricName:  "order_count",
					DataType:    "number",
					Aggregation: "COUNT",
					Formula:     fmt.Sprintf("COUNT(%s.%s)", ot, findField(fields, "order_id", "id")),
					Confidence:  0.9,
					Reason:      "订单记录数，衡量业务活跃度",
					IsComposite: false,
					Category:    "交易",
				})
			}
		}

		// 客单价
		if hasAmount != "" && hasUserId {
			amountField := findField(fields, "amount", "total_amount", "order_amount", "total")
			userIdField := findField(fields, "user_id")
			key := "客单价"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        ot,
					Field:        "",
					DisplayName:  "客单价",
					MetricName:   "avg_order_value",
					DataType:     "currency",
					Aggregation:  "COMPOSITE",
					Formula:      fmt.Sprintf("SUM(%s.%s) / COUNT(DISTINCT %s.%s)", ot, amountField, ot, userIdField),
					Confidence:   0.85,
					Reason:       "平均每笔订单金额，衡量用户消费能力的重要指标",
					IsComposite:  true,
					Dependencies: []string{fmt.Sprintf("%s.%s", ot, amountField), fmt.Sprintf("%s.%s", ot, userIdField)},
					Category:     "交易",
				})
			}
		}

		// 转化率（订单数 / 用户数）
		if len(userTables) > 0 && hasUserId {
			ut := userTables[0]
			userIdField := findField(fieldIndex[ut], "user_id", "id")
			orderIdField := findField(fields, "order_id", "id")
			key := "下单转化率"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        ot,
					Field:        "",
					DisplayName:  "下单转化率",
					MetricName:   "order_conversion_rate",
					DataType:     "percentage",
					Aggregation:  "COMPOSITE",
					Formula:      fmt.Sprintf("COUNT(DISTINCT %s.%s) / NULLIF(COUNT(DISTINCT %s.%s), 0) * 100", ot, orderIdField, ut, userIdField),
					Confidence:   0.7,
					Reason:       "有下单行为的用户 / 总用户数 * 100，衡量用户购买转化",
					IsComposite:  true,
					Dependencies: []string{fmt.Sprintf("%s.%s", ut, userIdField), fmt.Sprintf("%s.%s", ot, orderIdField)},
					Category:     "交易",
				})
			}
		}
	}

	// ========== 支付类指标 ==========
	for _, pt := range paymentTables {
		fields := fieldIndex[pt]
		hasAmount := getAmountField(fields)
		_ = hasField(fields, "status") // 预留给支付状态过滤用

		if hasAmount != "" {
			key := "支付金额"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        pt,
					Field:        hasAmount,
					DisplayName:  "支付金额",
					MetricName:   "payment_amount",
					DataType:     "currency",
					Aggregation:  "SUM",
					Formula:      fmt.Sprintf("SUM(%s.%s)", pt, hasAmount),
					Confidence:   0.9,
					Reason:       "支付成功的金额，衡量实际收入",
					IsComposite:  false,
					Dependencies: []string{fmt.Sprintf("%s.%s", pt, hasAmount)},
					Category:     "收入",
				})
			}
		}
	}

	// ========== 退款类指标 ==========
	for _, rt := range refundTables {
		fields := fieldIndex[rt]
		hasAmount := getAmountField(fields)

		if hasAmount != "" && len(orderTables) > 0 {
			// 退款额
			key := "退款额"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:       rt,
					Field:       hasAmount,
					DisplayName: "退款额",
					MetricName:  "refund_amount",
					DataType:    "currency",
					Aggregation: "SUM",
					Formula:     fmt.Sprintf("SUM(%s.%s)", rt, hasAmount),
					Confidence:  0.85,
					Reason:      "退款金额，衡量售后风险",
					IsComposite: false,
					Category:    "收入",
				})
			}

			// 退款率
			ot := orderTables[0]
			orderAmountField := getAmountField(fieldIndex[ot])
			if orderAmountField != "" {
				refundField := hasAmount
				key := "退款率"
				if !seen[key] {
					seen[key] = true
					recs = append(recs, KeyMetricRecommendation{
						Table:        "",
						Field:        "",
						DisplayName:  "退款率",
						MetricName:   "refund_rate",
						DataType:     "percentage",
						Aggregation:  "COMPOSITE",
						Formula:      fmt.Sprintf("SUM(%s.%s) / NULLIF(SUM(%s.%s), 0) * 100", rt, refundField, ot, orderAmountField),
						Confidence:   0.75,
						Reason:       "退款额 / 销售额 * 100，衡量商品质量和服务水平",
						IsComposite:  true,
						Dependencies: []string{fmt.Sprintf("%s.%s", rt, refundField), fmt.Sprintf("%s.%s", ot, orderAmountField)},
						Category:     "收入",
					})
				}
			}
		}
	}

	// ========== 商品类指标 ==========
	for _, pt := range productTables {
		fields := fieldIndex[pt]
		quantityField := findField(fields, "quantity", "stock", "inventory")
		hasProductId := hasField(fields, "product_id", "id", "sku_id")

		if quantityField != "" && hasProductId {
			key := "库存数量"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:        pt,
					Field:        quantityField,
					DisplayName:  "库存数量",
					MetricName:   "inventory_quantity",
					DataType:     "number",
					Aggregation:  "SUM",
					Formula:      fmt.Sprintf("SUM(%s.%s)", pt, quantityField),
					Confidence:   0.85,
					Reason:       "商品库存总量，监控库存健康",
					IsComposite:  false,
					Dependencies: []string{fmt.Sprintf("%s.%s", pt, quantityField)},
					Category:     "库存",
				})
			}
		}

		if hasProductId {
			key := "商品数"
			if !seen[key] {
				seen[key] = true
				recs = append(recs, KeyMetricRecommendation{
					Table:       pt,
					Field:       findField(fields, "product_id", "id"),
					DisplayName: "商品数",
					MetricName:  "product_count",
					DataType:    "number",
					Aggregation: "COUNT",
					Formula:     fmt.Sprintf("COUNT(DISTINCT %s.%s)", pt, findField(fields, "product_id", "id")),
					Confidence:  0.85,
					Reason:      "商品 SKU 总数，衡量商品丰富度",
					IsComposite: false,
					Category:    "库存",
				})
			}
		}
	}

	// ========== 综合类指标（复用 AI 分析的 Recommendations）==========
	if aiAnalysis != nil && len(aiAnalysis.Recommendations) > 0 {
		for _, rec := range aiAnalysis.Recommendations {
			agg := strings.ToUpper(rec.Aggregation)
			key := rec.DisplayName
			if seen[key] {
				continue
			}
			seen[key] = true

			dataType := "number"
			if rec.DataType == "currency" {
				dataType = "currency"
			} else if rec.DataType == "ratio" {
				dataType = "percentage"
			}

			formula := rec.Formula
			if formula == "" {
				formula = fmt.Sprintf("%s(%s.%s)", agg, rec.Table, rec.Field)
			}

			recs = append(recs, KeyMetricRecommendation{
				Table:        rec.Table,
				Field:        rec.Field,
				DisplayName:  rec.DisplayName,
				MetricName:   toSnakeCase(rec.DisplayName),
				DataType:     dataType,
				Aggregation:  agg,
				Formula:      formula,
				Confidence:   rec.Confidence,
				Reason:       fmt.Sprintf("AI 分析推荐（置信度 %.0f%%）：%s", rec.Confidence*100, rec.Reason),
				IsComposite:  rec.IsComposite,
				Dependencies: rec.Dependencies,
				Category:     inferCategory(rec.Table, rec.Field),
			})
		}
	}

	return recs
}

// ========== 辅助函数 ==========

func containsAny(s string, parts ...string) bool {
	lower := strings.ToLower(s)
	for _, p := range parts {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

func hasField(fields []fieldInfo, names ...string) bool {
	for _, f := range fields {
		for _, n := range names {
			if strings.EqualFold(f.name, n) {
				return true
			}
		}
	}
	return false
}

func findField(fields []fieldInfo, names ...string) string {
	for _, f := range fields {
		for _, n := range names {
			if strings.EqualFold(f.name, n) {
				return f.name
			}
		}
	}
	// 回退：返回第一个字段
	if len(fields) > 0 {
		return fields[0].name
	}
	return ""
}

func getAmountField(fields []fieldInfo) string {
	amountNames := []string{"amount", "total_amount", "order_amount", "payment_amount",
		"price", "total_price", "sale_amount", "revenue", "gmv", "sales",
		"discount_amount", "refund_amount", "cost", "profit"}
	for _, f := range fields {
		for _, n := range amountNames {
			if strings.EqualFold(f.name, n) {
				return f.name
			}
		}
	}
	return ""
}

func inferCategory(table, field string) string {
	lower := strings.ToLower(table + " " + field)
	if containsAny(lower, "user", "member", "customer", "register", "登录", "活跃") {
		return "用户"
	}
	if containsAny(lower, "order", "transaction", "trade", "下单", "订单") {
		return "交易"
	}
	if containsAny(lower, "payment", "pay", "收入", "退款", "revenue") {
		return "收入"
	}
	if containsAny(lower, "product", "item", "sku", "inventory", "库存", "商品") {
		return "库存"
	}
	if containsAny(lower, "visit", "click", "pv", "uv", "流量", "访问", "浏览") {
		return "流量"
	}
	return "其他"
}

func toSnakeCase(s string) string {
	// 简单转下划线命名
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "（", "_")
	s = strings.ReplaceAll(s, "）", "")
	s = strings.ReplaceAll(s, "数", "")
	s = strings.ReplaceAll(s, "率", "_rate")
	s = strings.ReplaceAll(s, "额", "_amount")
	s = strings.ReplaceAll(s, "量", "_count")
	s = strings.ReplaceAll(s, "价", "_price")
	s = strings.ReplaceAll(s, "__", "_")
	return strings.ToLower(s)
}

// ToDraftMetrics 将推荐结果转换为草稿指标
func (s *MetricDiscoveryService) ToDraftMetrics(
	tenantID, dataSourceID string,
	recommendations []KeyMetricRecommendation,
) ([]model.Metric, error) {
	metrics := []model.Metric{}

	for _, rec := range recommendations {
		agg := model.MetricAggregation(strings.ToUpper(rec.Aggregation))

		dataType := model.MetricDataType("number")
		if rec.DataType == "currency" {
			dataType = model.MetricTypeCurrency
		} else if rec.DataType == "percentage" || rec.DataType == "ratio" {
			dataType = model.MetricTypePercentage
		}

		formula := rec.Formula
		if formula == "" {
			if rec.Table != "" && rec.Field != "" {
				formula = fmt.Sprintf("%s(%s.%s)", strings.ToUpper(rec.Aggregation), rec.Table, rec.Field)
			}
		}

		metricName := rec.MetricName
		if metricName == "" {
			metricName = toSnakeCase(rec.DisplayName)
		}

		metric := model.Metric{
			ID:              fmt.Sprintf("metric_%s", uuid.NewString()),
			TenantID:        tenantID,
			DataSourceID:    dataSourceID,
			Name:            metricName,
			DisplayName:     rec.DisplayName,
			Description:     fmt.Sprintf("AI 智能发现（置信度 %.0f%%）：%s", rec.Confidence*100, rec.Reason),
			DataType:        dataType,
			Aggregation:     agg,
			Formula:         formula,
			BaseTable:       rec.Table,
			BaseField:       rec.Field,
			IsAutoDetected:  true,
			ConfidenceScore: rec.Confidence,
			Status:          "draft",
			Category:        rec.Category,
		}

		if rec.IsComposite && len(rec.Dependencies) > 0 {
			depsJSON, _ := json.Marshal(rec.Dependencies)
			metric.DependentMetrics = string(depsJSON)
		}

		metrics = append(metrics, metric)
	}

	return metrics, nil
}
