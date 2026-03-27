package service

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"ai-bi-server/internal/model"
)

// SchemaAnalysisService AI Schema 分析服务
type SchemaAnalysisService struct {
	llmService      *LLMService
	aiConfigService *AIConfigService
}

func normalizeStringSlice(v interface{}) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, it := range t {
			if s, ok := it.(string); ok && s != "" {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

// NewSchemaAnalysisService 创建 Schema 分析服务
func NewSchemaAnalysisService(llmService *LLMService, aiConfigService *AIConfigService) *SchemaAnalysisService {
	return &SchemaAnalysisService{
		llmService:      llmService,
		aiConfigService: aiConfigService,
	}
}

// SchemaDiff schema 差异描述
type SchemaDiff struct {
	NewTables []string   `json:"newTables"` // 新增的表
	DelTables []string   `json:"delTables"` // 删除的表
	NewFields []FieldKey `json:"newFields"` // 现有表中新增的字段
	ModFields []FieldKey `json:"modFields"` // 现有表中类型/约束变化的字段
	Unchanged []string   `json:"unchanged"` // 未变化的表
}

// FieldKey 字段唯一标识
type FieldKey struct {
	Table string `json:"table"`
	Field string `json:"field"`
}

// AnalyzeSchema 调用 AI 完整分析数据库 schema（首次分析或强制重分析）
func (s *SchemaAnalysisService) AnalyzeSchema(tenantID string, ds *model.DataSource) (*model.SchemaAIAnalysis, error) {
	// 生成 schema 描述文本
	schemaText := s.buildSchemaText(ds)

	// 构建 prompt
	systemPrompt := s.buildSystemPrompt()
	userPrompt := s.buildUserPrompt(schemaText)

	// 调用 AI
	resp, err := s.llmService.CallLLMJSON(tenantID, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI analysis failed: %w", err)
	}

	// 解析 JSON 响应
	return s.parseAIResponse(resp, tenantID, ds)
}

// DiffSchema 对比旧的分析结果和新的 schema，返回差异
func (s *SchemaAnalysisService) DiffSchema(oldAnalysis *model.SchemaAIAnalysis, newDS *model.DataSource) *SchemaDiff {
	diff := &SchemaDiff{
		NewTables: []string{},
		DelTables: []string{},
		NewFields: []FieldKey{},
		ModFields: []FieldKey{},
		Unchanged: []string{},
	}

	// 构建旧分析中已有表的索引
	oldTables := make(map[string]bool)
	oldFields := make(map[string]bool) // "table:field" -> true
	if oldAnalysis != nil {
		for _, t := range oldAnalysis.Tables {
			oldTables[t.Table] = true
		}
		for _, f := range oldAnalysis.Fields {
			oldFields[f.Table+":"+f.Field] = true
		}
	}

	newSchema, _ := DeserializeSchemaInfo(newDS.SchemaInfo)
	newTables := normalizeStringSlice(newSchema["tables"])
	newStructure, _ := newSchema["structure"].(map[string]interface{})

	// 遍历新 schema，找新增的表和字段
	for _, table := range newTables {
		if !oldTables[table] {
			// 整张新表
			diff.NewTables = append(diff.NewTables, table)
		} else {
			// 现有表，检查是否有新字段
			hasNew := false
			if cols, ok := newStructure[table].([]interface{}); ok {
				for _, col := range cols {
					if colMap, ok := col.(map[string]interface{}); ok {
						fieldName := getString(colMap, "field")
						key := table + ":" + fieldName
						if !oldFields[key] {
							diff.NewFields = append(diff.NewFields, FieldKey{Table: table, Field: fieldName})
							hasNew = true
						}
					}
				}
			}
			if !hasNew {
				diff.Unchanged = append(diff.Unchanged, table)
			}
		}
	}

	// 遍历旧分析中的表，找已删除的表
	if oldAnalysis != nil {
		for _, t := range oldAnalysis.Tables {
			found := false
			for _, nt := range newTables {
				if nt == t.Table {
					found = true
					break
				}
			}
			if !found {
				diff.DelTables = append(diff.DelTables, t.Table)
			}
		}
	}

	return diff
}

// IncrementalAnalyzeSchema 增量分析：对比旧分析和新 schema，只对变化部分调用 AI
// 策略：
//   - 新增的表：全量 AI 分析
//   - 现有表新增字段：只分析这些新字段
//   - 删除的表/字段：从旧分析中剔除
//   - 未变化的表/字段：直接复用旧分析
func (s *SchemaAnalysisService) IncrementalAnalyzeSchema(tenantID string, newDS *model.DataSource, oldAnalysis *model.SchemaAIAnalysis) (*model.SchemaAIAnalysis, *SchemaDiff, error) {
	diff := s.DiffSchema(oldAnalysis, newDS)

	// 如果完全没有变化，直接返回旧分析
	if len(diff.NewTables) == 0 && len(diff.DelTables) == 0 && len(diff.NewFields) == 0 && len(diff.ModFields) == 0 {
		return oldAnalysis, diff, nil
	}

	// 构建增量 schema 文本（只包含新增/变化的表和字段）
	incrementalText := s.buildIncrementalSchemaText(newDS, diff)

	// 构建增量分析 prompt
	systemPrompt := s.buildIncrementalSystemPrompt(diff)
	userPrompt := s.buildIncrementalUserPrompt(incrementalText)

	// 调用 AI 分析增量部分
	resp, err := s.llmService.CallLLMJSON(tenantID, systemPrompt, userPrompt)
	if err != nil {
		// AI 调用失败时，返回差异信息但不更新分析结果
		return nil, diff, fmt.Errorf("AI incremental analysis failed: %w", err)
	}

	// 解析增量分析结果
	incrementalResult, err := s.parseIncrementalResponse(resp, tenantID, diff)
	if err != nil {
		return nil, diff, err
	}

	// 合并旧分析和增量结果
	merged := s.mergeAnalysis(oldAnalysis, incrementalResult, diff)

	// 填充元数据
	merged.AnalyzedAt = time.Now().Format(time.RFC3339)
	cfg, _ := s.aiConfigService.GetOrInitConfig(tenantID)
	if cfg != nil {
		merged.ModelUsed = cfg.Model
	}

	return merged, diff, nil
}

// buildIncrementalSchemaText 构建增量 schema 描述（只包含需要分析的表/字段）
func (s *SchemaAnalysisService) buildIncrementalSchemaText(ds *model.DataSource, diff *SchemaDiff) string {
	var sb strings.Builder
	newSchema, _ := DeserializeSchemaInfo(ds.SchemaInfo)
	structure, _ := newSchema["structure"].(map[string]interface{})

	sb.WriteString(fmt.Sprintf("数据源名称: %s\n\n", ds.Name))

	// 新增的表
	if len(diff.NewTables) > 0 {
		sb.WriteString("## 新增的表（需全量分析）\n\n")
		for _, table := range diff.NewTables {
			sb.WriteString(fmt.Sprintf("### 表: %s\n", table))
			if cols, ok := structure[table].([]interface{}); ok {
				sb.WriteString("| 字段名 | 类型 | 可空 | 主键 |\n")
				sb.WriteString("|--------|------|------|------|\n")
				for _, col := range cols {
					if colMap, ok := col.(map[string]interface{}); ok {
						field := getString(colMap, "field")
						colType := getString(colMap, "type")
						nullable := "否"
						if getBool(colMap, "nullable") {
							nullable = "是"
						}
						key := ""
						if k, ok := colMap["key"].(string); ok && k == "PRI" {
							key = "PRI"
						}
						sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", field, colType, nullable, key))
					}
				}
			}
			sb.WriteString("\n")
		}
	}

	// 现有表的新增字段
	if len(diff.NewFields) > 0 {
		sb.WriteString("## 现有表中新增的字段\n\n")
		// 按表分组
		byTable := make(map[string][]FieldKey)
		for _, f := range diff.NewFields {
			byTable[f.Table] = append(byTable[f.Table], f)
		}
		for table, fields := range byTable {
			sb.WriteString(fmt.Sprintf("### 表: %s（新增字段）\n", table))
			if cols, ok := structure[table].([]interface{}); ok {
				sb.WriteString("| 字段名 | 类型 | 可空 | 主键 |\n")
				sb.WriteString("|--------|------|------|------|\n")
				for _, col := range cols {
					if colMap, ok := col.(map[string]interface{}); ok {
						fieldName := getString(colMap, "field")
						// 只包含新增字段
						isNew := false
						for _, f := range fields {
							if f.Field == fieldName {
								isNew = true
								break
							}
						}
						if !isNew {
							continue
						}
						colType := getString(colMap, "type")
						nullable := "否"
						if getBool(colMap, "nullable") {
							nullable = "是"
						}
						key := ""
						if k, ok := colMap["key"].(string); ok && k == "PRI" {
							key = "PRI"
						}
						sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", fieldName, colType, nullable, key))
					}
				}
			}
			sb.WriteString("\n")
		}
	}

	// 删除的表
	if len(diff.DelTables) > 0 {
		sb.WriteString(fmt.Sprintf("## 已删除的表（将从分析结果中移除）\n- %s\n\n", strings.Join(diff.DelTables, ", ")))
	}

	return sb.String()
}

// buildIncrementalSystemPrompt 增量分析的 system prompt
func (s *SchemaAnalysisService) buildIncrementalSystemPrompt(diff *SchemaDiff) string {
	var sb strings.Builder
	sb.WriteString("你是一位专业的数据仓库架构师和 BI 分析师。以下是一个数据库的增量 schema 变更，请只分析这些新增/变更的部分。\n")

	if len(diff.NewTables) > 0 {
		sb.WriteString(fmt.Sprintf("- 新增表：%s（共 %d 张）\n", strings.Join(diff.NewTables, ", "), len(diff.NewTables)))
	}
	if len(diff.NewFields) > 0 {
		byTable := make(map[string][]FieldKey)
		for _, f := range diff.NewFields {
			byTable[f.Table] = append(byTable[f.Table], f)
		}
		sb.WriteString("- 现有表新增字段：\n")
		for table, fields := range byTable {
			fieldNames := make([]string, len(fields))
			for i, f := range fields {
				fieldNames[i] = f.Field
			}
			sb.WriteString(fmt.Sprintf("  %s.%s（共 %d 个新字段）\n", table, strings.Join(fieldNames, ", "), len(fields)))
		}
	}
	if len(diff.DelTables) > 0 {
		sb.WriteString(fmt.Sprintf("- 已删除表：%s（请在分析结果中移除）\n", strings.Join(diff.DelTables, ", ")))
	}

	sb.WriteString(`
## 语义类型定义
- **metric**: 可量化的业务指标字段
- **dimension**: 描述性维度字段
- **time**: 时间相关字段
- **geo**: 地理位置字段
- **category**: 分类/枚举字段
- **identifier**: 标识符（不适合作为指标）
- **technical**: 纯技术字段
- **unknown**: 无法判断

## 指标聚合方式
- **SUM**: 金额、数量、销量
- **COUNT**: 记录数
- **AVG**: 平均值类
- **MAX/MIN**: 极值类
- **COUNT(DISTINCT)**: 去重计数

## 输出格式（仅输出 JSON，不要额外文字）`)
	return sb.String()
}

// buildIncrementalUserPrompt 增量分析的用户 prompt
func (s *SchemaAnalysisService) buildIncrementalUserPrompt(incrementalText string) string {
	return `请分析以下增量 schema 变更，返回结构化的分析结果：

` + incrementalText + `

请严格按照 JSON 格式输出（必须包含 fields、tables、recommendations、dimensions 四个数组）。
只分析新增的表和字段，不要重复分析已存在的内容。`
}

// parseIncrementalResponse 解析增量分析的 AI 响应
func (s *SchemaAnalysisService) parseIncrementalResponse(resp string, tenantID string, diff *SchemaDiff) (*model.SchemaAIAnalysis, error) {
	cleaned := strings.TrimSpace(resp)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var result model.SchemaAIAnalysis
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		start := strings.Index(cleaned, "{")
		end := strings.LastIndex(cleaned, "}")
		if start != -1 && end != -1 && end > start {
			cleaned = cleaned[start : end+1]
		}
		if err2 := json.Unmarshal([]byte(cleaned), &result); err2 != nil {
			return nil, fmt.Errorf("failed to parse incremental AI response: %w", err2)
		}
	}

	if result.Fields == nil {
		result.Fields = []model.FieldSemanticAI{}
	}
	if result.Tables == nil {
		result.Tables = []model.TableSemanticAI{}
	}
	if result.Recommendations == nil {
		result.Recommendations = []model.MetricRecommendation{}
	}
	if result.Dimensions == nil {
		result.Dimensions = []model.DimensionRecommendation{}
	}

	return &result, nil
}

// mergeAnalysis 合并旧分析和增量分析结果
func (s *SchemaAnalysisService) mergeAnalysis(old, incremental *model.SchemaAIAnalysis, diff *SchemaDiff) *model.SchemaAIAnalysis {
	result := &model.SchemaAIAnalysis{
		Fields:          []model.FieldSemanticAI{},
		Tables:          []model.TableSemanticAI{},
		Recommendations: []model.MetricRecommendation{},
		Dimensions:      []model.DimensionRecommendation{},
	}

	// 构建旧分析中已有内容的索引
	keepFields := make(map[string]bool) // "table:field"
	keepTables := make(map[string]bool) // "table"
	keepRecs := make(map[string]bool)   // "table:field"
	keepDims := make(map[string]bool)   // "table:field"

	// 需要删除的表集合
	delTables := make(map[string]bool)
	for _, t := range diff.DelTables {
		delTables[t] = true
	}

	// 需要保留的表集合
	keepTableSet := make(map[string]bool)
	for _, t := range diff.Unchanged {
		keepTableSet[t] = true
	}
	for _, f := range diff.NewFields {
		keepTableSet[f.Table] = true
	}
	for _, nt := range diff.NewTables {
		keepTableSet[nt] = true
	}

	if old != nil {
		// 保留未变化的字段
		for _, f := range old.Fields {
			if keepTableSet[f.Table] && !delTables[f.Table] {
				result.Fields = append(result.Fields, f)
				keepFields[f.Table+":"+f.Field] = true
			}
		}
		// 保留未变化的表
		for _, t := range old.Tables {
			if keepTableSet[t.Table] && !delTables[t.Table] {
				result.Tables = append(result.Tables, t)
				keepTables[t.Table] = true
			}
		}
		// 保留未变化的推荐指标（基于字段判断）
		for _, r := range old.Recommendations {
			if keepTableSet[r.Table] && !delTables[r.Table] {
				result.Recommendations = append(result.Recommendations, r)
				keepRecs[r.Table+":"+r.Field] = true
			}
		}
		// 保留未变化的推荐维度
		for _, d := range old.Dimensions {
			if keepTableSet[d.Table] && !delTables[d.Table] {
				result.Dimensions = append(result.Dimensions, d)
				keepDims[d.Table+":"+d.Field] = true
			}
		}
	}

	// 追加增量分析的字段
	for _, f := range incremental.Fields {
		result.Fields = append(result.Fields, f)
	}
	// 追加增量分析的表
	for _, t := range incremental.Tables {
		result.Tables = append(result.Tables, t)
	}
	// 追加增量分析的推荐指标（去重）
	for _, r := range incremental.Recommendations {
		key := r.Table + ":" + r.Field
		if !keepRecs[key] {
			result.Recommendations = append(result.Recommendations, r)
		}
	}
	// 追加增量分析的推荐维度（去重）
	for _, d := range incremental.Dimensions {
		key := d.Table + ":" + d.Field
		if !keepDims[key] {
			result.Dimensions = append(result.Dimensions, d)
		}
	}

	return result
}

// buildSchemaText 将 schema 信息转换为易于 AI 理解的文本描述
func (s *SchemaAnalysisService) buildSchemaText(ds *model.DataSource) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("数据源名称: %s\n", ds.Name))
	sb.WriteString(fmt.Sprintf("数据库类型: %s\n\n", ds.Type))

	schema, err := DeserializeSchemaInfo(ds.SchemaInfo)
	if err != nil {
		return ""
	}

	tables := normalizeStringSlice(schema["tables"])
	structure, _ := schema["structure"].(map[string]interface{})

	sb.WriteString(fmt.Sprintf("共 %d 张表:\n\n", len(tables)))

	for _, table := range tables {
		sb.WriteString(fmt.Sprintf("## 表: %s\n", table))

		if cols, ok := structure[table].([]interface{}); ok {
			sb.WriteString("| 字段名 | 类型 | 可空 | 主键 |\n")
			sb.WriteString("|--------|------|------|------|\n")

			for _, col := range cols {
				if colMap, ok := col.(map[string]interface{}); ok {
					field := getString(colMap, "field")
					colType := getString(colMap, "type")
					nullable := "否"
					if getBool(colMap, "nullable") {
						nullable = "是"
					}
					key := ""
					if k, ok := colMap["key"].(string); ok && k == "PRI" {
						key = "PRI"
					}
					sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", field, colType, nullable, key))
				}
			}
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

// buildSystemPrompt 构建系统提示词
func (s *SchemaAnalysisService) buildSystemPrompt() string {
	return `你是一位专业的数据仓库架构师和 BI 分析师。你的任务是分析给定数据库的 schema，理解每个表和字段的业务含义，并给出语义标签和推荐配置。

## 最高原则：指标命名必须来自真实字段

**最重要的一条**：你推荐的所有指标，其 displayName 必须基于该数据库中**实际存在的字段名**进行语义翻译。绝对不要凭空生成"GMV"、"订单数"、"客单价"这类通用名称。

### 正确做法（基于真实字段名）
假设某张表有字段 sales_amount，你应该推荐：
- displayName: "销售额"（从 sales_amount 翻译）
- formula: SUM(table.sales_amount)

假设某张表有字段 total_revenue，你应该推荐：
- displayName: "总收入"（从 total_revenue 翻译）
- formula: SUM(table.total_revenue)

假设某张表有字段 item_count，你应该推荐：
- displayName: "商品数量"（从 item_count 翻译）
- formula: SUM(table.item_count)

### 错误做法（凭空编造指标名）
- 错误：displayName: "GMV"（除非 schema 中有明确叫 gmv 或 gross_merchandise_value 的字段）
- 错误：displayName: "订单数"（除非 schema 中有叫 order_count 或类似字段）
- 错误：displayName: "客单价"（这是一个派生指标，需要严格前提）
- 错误：displayName: "用户复购率"（需要业务域明确支持）

## 核心原则

1. **指标命名来自字段**：指标名称必须是对 schema 中实际字段的语义翻译，不允许凭空编造通用名称
2. **业务价值优先**：指标必须"有业务衡量意义"才推荐。技术上可计算不等于业务上有价值
3. **业务语义优先**：不要只看字段名，要结合表业务类型推断字段在业务中的含义
4. **排除技术字段**：忽略纯技术性的、不承载业务信息的字段（如 id、created_at、updated_at、deleted_at、version、sort_order、is_deleted 等）
5. **先识表，再识字段**：先判断每张表的业务类型（fact/dimension/log），再决定推荐什么指标
6. **谨慎推荐派生指标**：复合/派生指标需要满足严格的前提条件才推荐

## 语义类型定义

- **metric**: 可量化的业务指标字段，适合作为分析的核心数值
- **dimension**: 描述性维度字段，用于对指标进行切分和筛选
- **time**: 时间相关字段
- **geo**: 地理位置字段
- **category**: 分类/枚举字段
- **identifier**: 标识符（主键、外键），不适合作为指标
- **technical**: 纯技术字段，无业务分析价值
- **unknown**: 无法判断

## 指标聚合方式推荐

- **SUM**: 金额、数量、销量等可累加的字段（amount、price、quantity、sales、revenue、cost）
- **COUNT**: 记录数、事件数（id 字段的 COUNT = 记录数）
- **AVG**: 平均值类（平均单价、平均评分、平均时长）
- **MAX/MIN**: 极值类（最大订单额、最高分）
- **COUNT(DISTINCT)**: 去重计数（去重用户数、去重商品数）

## 字段语义判断标准

### 标记为 metric 的条件（必须同时满足）
1. 是数值类型（int、decimal、float 等）
2. 承载可量化的业务信息
3. 聚合后有业务意义（SUM(amount) = 总销售额，有意义）
4. 不是纯序号、权重、排序等技术字段

### 标记为 technical 的字段
- 主键 id、外键 xxx_id（这些属于 identifier，不是 metric）
- 时间戳 created_at、updated_at（属于 time 类型，不是 metric）
- 软删除标记 is_deleted、is_active
- 排序字段 sort_order、display_order
- 密码、token、哈希值等安全相关字段

### 标记为 dimension 的字段
- 分类字段：category、type、status、level、vip_level
- 地理字段：province、city、country、region
- 时间字段：created_at、order_date、pay_time
- 实体名称字段：name、title（通常作为描述性维度，不是指标）

### 表的业务类型（businessType）
- **fact**：事实表，记录业务事件或交易（orders、order_items、payments）
- **dimension**：维度表，记录实体信息（customers、products、categories）
- **transaction**：独立的交易流水表
- **log**：日志/流水记录表
- **mapping**：关联/桥接表
- **summary**：定时汇总表（daily_sales_summary 等）
- **unknown**：无法判断

## 业务域识别与派生指标（避免电商偏见）

### 第一步：识别业务域
基于表名和字段模式判断业务域：

| 业务域 | 典型表名/字段模式 |
|--------|------------------|
| 电商/交易 | orders, order_items, payments, products, customers, carts, checkout |
| 内容/社区 | posts, articles, blogs, comments, likes, followers, topics, tags, feeds |
| SaaS/项目/工单 | projects, tasks, issues, tickets, sprints, assignees, status, milestones |
| 物联网/监控 | devices, sensors, readings, metrics, events, alerts, telemetry |
| 教育/学习 | students, courses, lessons, enrollments, scores, attempts, grades |
| 营销/广告 | campaigns, impressions, clicks, conversions, ctr, cpc, budgets |
| 金融/支付 | transactions, accounts, balances, withdrawals, deposits, transfers |
| 通用日志/审计 | logs, events, audit, activity, traces, history |

### 第二步：只推荐业务域匹配的派生指标

**严格规则**：派生指标（如转化率、比值、平均值）的 displayName 必须基于 schema 中实际存在的字段。

示例：假设识别到电商域，schema 中有 order_amount 字段，则：
- 正确：displayName: "平均订单金额"（从 order_amount 推断合理）
- 错误：displayName: "客单价"（这是凭空编造的名称，应该从实际字段翻译）

示例：假设识别到营销域，schema 中有 impressions 和 clicks 字段，则：
- 正确：displayName: "点击率"（基于 impressions+clicks 两个实际字段）
- 错误：displayName: "转化率"（如果没有 conversions 字段，不应推荐）

### 派生指标推荐前提（全部满足才推荐）

| 派生指标类型 | 必需前提 |
|------------|---------|
| 转化率/成功率 | schema 中同时存在"总分子"和"分母"字段（如总访问+转化事件） |
| 平均值类 | schema 中同时存在"总量"字段和"计数"字段 |
| 占比类 | schema 中同时存在"部分"和"总体"字段 |
| 复购率/留存率 | schema 中同时存在"用户表+有时间戳的用户行为表"，且时间跨多天 |
| GMV/销售额 | schema 中有明确叫 gmv/gross_amount/total_amount/sales_amount 的字段 |
| 订单数 | schema 中有明确叫 order_count/transaction_count 的字段，或有订单主表可计数 |
| 客单价 | schema 中同时存在金额字段和用户维度，且明确是交易域 |

**如果上述前提不满足，不推荐该派生指标。不要降低 confidence 后强行推荐。**

### 不推荐的情况（绝对禁止）
1. ❌ schema 中没有任何与"订单"相关的表/字段，却推荐"GMV"、"订单数"
2. ❌ schema 中没有任何与"用户复购"相关的表/字段，却推荐"用户复购率"
3. ❌ 没有实际的金额字段，却推荐"客单价"
4. ❌ 不论什么业务域都推荐"访问量"、"点击量"、"转化率"

## 输出格式

请以 JSON 格式返回分析结果，必须包含以下结构：

{
  "fields": [
    {
      "table": "表名",
      "field": "字段名",
      "semanticType": "metric/dimension/time/geo/category/identifier/technical/unknown",
      "subType": "子类型（如metric下的amount/count/ratio）",
      "businessName": "AI推荐的中文业务名称",
      "aggregation": "推荐聚合方式（仅对metric有效）",
      "confidence": 0.0-1.0的置信度,
      "reason": "判断理由",
      "tags": ["标签列表"]
    }
  ],
  "tables": [
    {
      "table": "表名",
      "businessType": "fact/dimension/transaction/log/mapping/summary/unknown",
      "summary": "表的业务概述",
      "isPrimary": true/false,
      "confidence": 0.0-1.0,
      "reason": "判断理由",
      "tags": ["transaction_table", "core_table"]
    }
  ],
  "recommendations": [
    {
      "table": "表名",
      "field": "字段名",
      "displayName": "推荐的中文指标名（必须基于该字段的实际名称翻译，禁止凭空编造）",
      "dataType": "number/currency/ratio/percentage",
      "aggregation": "SUM/COUNT/AVG/COUNT(DISTINCT)",
      "isDerived": false,
      "formula": "仅对 isDerived=true 时填写",
      "confidence": 0.0-1.0,
      "reason": "为什么推荐这个指标（必须说明字段依据）"
    }
  ],
  "dimensions": [
    {
      "table": "表名",
      "field": "字段名",
      "displayName": "推荐的中文维度名",
      "dimType": "time/geo/category/identifier",
      "confidence": 0.0-1.0,
      "reason": "为什么推荐这个维度"
    }
  ]
}

## 注意事项

1. 只输出 JSON，不要输出任何解释性文字
2. 只分析有业务含义的字段，忽略纯技术字段
3. **指标名称必须是对 schema 中实际字段的语义翻译**，格式为：字段业务含义 + 度量对象（如"订单金额"、"支付笔数"、"课程总数"）
4. 派生指标必须严格检查前提条件，不满足时不推荐，而非降低 confidence 后推荐
5. 推荐数量控制：单张表的推荐指标不超过 5 个（包含基础指标和派生指标），优先推荐最核心的
 6. 业务域不明确时，只推荐基础指标（单字段可聚合），不推荐任何派生/复合指标`
}

// buildUserPrompt 构建用户提示词
func (s *SchemaAnalysisService) buildUserPrompt(schemaText string) string {
	return `请分析以下数据库 schema，理解每个字段的业务含义，并返回结构化的分析结果：

` + schemaText + `

请严格按照上述 JSON 格式输出分析结果。`
}

// parseAIResponse 解析 AI 返回的 JSON 响应
func (s *SchemaAnalysisService) parseAIResponse(resp string, tenantID string, ds *model.DataSource) (*model.SchemaAIAnalysis, error) {
	// 尝试提取 JSON（AI 可能返回带 markdown 代码块包裹的 JSON）
	cleaned := strings.TrimSpace(resp)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var analysis model.SchemaAIAnalysis
	if err := json.Unmarshal([]byte(cleaned), &analysis); err != nil {
		// 尝试查找 JSON 边界
		start := strings.Index(cleaned, "{")
		end := strings.LastIndex(cleaned, "}")
		if start != -1 && end != -1 && end > start {
			cleaned = cleaned[start : end+1]
		}
		if err2 := json.Unmarshal([]byte(cleaned), &analysis); err2 != nil {
			return nil, fmt.Errorf("failed to parse AI response as JSON: %w (raw: %.200s)", err2, resp)
		}
	}

	// 填充元数据
	analysis.AnalyzedAt = time.Now().Format(time.RFC3339)
	cfg, _ := s.aiConfigService.GetOrInitConfig(tenantID)
	if cfg != nil {
		analysis.ModelUsed = cfg.Model
	}

	// 确保非空切片
	if analysis.Fields == nil {
		analysis.Fields = []model.FieldSemanticAI{}
	}
	if analysis.Tables == nil {
		analysis.Tables = []model.TableSemanticAI{}
	}
	if analysis.Recommendations == nil {
		analysis.Recommendations = []model.MetricRecommendation{}
	}
	if analysis.Dimensions == nil {
		analysis.Dimensions = []model.DimensionRecommendation{}
	}

	return &analysis, nil
}

// SerializeAIAnalysis 序列化 AI 分析结果
func SerializeAIAnalysis(analysis *model.SchemaAIAnalysis) (string, error) {
	data, err := json.Marshal(analysis)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// DeserializeAIAnalysis 反序列化 AI 分析结果
func DeserializeAIAnalysis(data string) (*model.SchemaAIAnalysis, error) {
	if data == "" {
		return nil, nil
	}
	var analysis model.SchemaAIAnalysis
	if err := json.Unmarshal([]byte(data), &analysis); err != nil {
		return nil, err
	}
	return &analysis, nil
}
