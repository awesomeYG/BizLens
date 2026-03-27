package service

import (
	"fmt"
	"strings"

	"gorm.io/gorm"

	"ai-bi-server/internal/model"
)

// NL2SQLService 自然语言转 SQL 服务
type NL2SQLService struct {
	db                *gorm.DB
	llmService        *LLMService
	dataSourceService *DataSourceService
}

// NewNL2SQLService 创建 NL2SQL 服务
func NewNL2SQLService(db *gorm.DB, llmService *LLMService, dataSourceService *DataSourceService) *NL2SQLService {
	return &NL2SQLService{db: db, llmService: llmService, dataSourceService: dataSourceService}
}

// NL2SQLRequest NL2SQL 请求
type NL2SQLRequest struct {
	TenantID     string
	UserID       string
	Question     string
	DataSourceID string
}

// NL2SQLResponse NL2SQL 响应
type NL2SQLResponse struct {
	SQL      string
	Summary  string
	Metadata map[string]interface{}
}

// ProcessDataQuery 处理数据查询请求
func (s *NL2SQLService) ProcessDataQuery(req NL2SQLRequest) (*NL2SQLResponse, error) {
	// 1. 确定数据源
	ds, err := s.resolveDataSource(req.TenantID, req.DataSourceID)
	if err != nil {
		return nil, fmt.Errorf("未找到可用的数据源：请先在设置中添加并同步数据库")
	}

	// 2. 构建查询上下文
	context := s.buildQueryContext(ds)

	// 3. 生成 SQL（带重试）
	sql, err := s.generateSQLWithRetry(req.Question, context)
	if err != nil {
		return nil, fmt.Errorf("SQL 生成失败：%s", err.Error())
	}

	// 4. 安全检查
	if err := s.validateSQL(sql); err != nil {
		return nil, err
	}

	// 5. 执行查询
	rows, err := s.dataSourceService.ExecuteQuery(ds, sql)
	if err != nil {
		return nil, fmt.Errorf("执行失败：%s", err.Error())
	}

	// 6. 格式化结果
	summary := s.formatQueryResult(req.Question, sql, rows)

	return &NL2SQLResponse{
		SQL:     sql,
		Summary: summary,
		Metadata: map[string]interface{}{
			"rowCount":   len(rows),
			"tableCount": len(context.tables),
			"dsType":     ds.Type,
		},
	}, nil
}

// resolveDataSource 确定要查询的数据源
func (s *NL2SQLService) resolveDataSource(tenantID, dataSourceID string) (*model.DataSource, error) {
	if dataSourceID != "" {
		return s.dataSourceService.GetDataSource(dataSourceID, tenantID)
	}

	dataSources, err := s.dataSourceService.ListDataSources(tenantID)
	if err != nil {
		return nil, err
	}

	for _, ds := range dataSources {
		if ds.Status == model.DSStatusConnected && ds.SchemaInfo != "" {
			return &ds, nil
		}
	}

	return nil, fmt.Errorf("no available data source")
}

// QueryContext NL2SQL 上下文
type QueryContext struct {
	dsType    string
	tables    []string
	structure map[string][]ColumnInfo
	analysis  *model.SchemaAIAnalysis
}

// ColumnInfo 列信息
type ColumnInfo struct {
	Field    string
	Type     string
	Nullable bool
	Key      string
	HasIndex bool
}

// buildQueryContext 构建 NL -> SQL 的 prompt 上下文
func (s *NL2SQLService) buildQueryContext(ds *model.DataSource) *QueryContext {
	ctx := &QueryContext{
		dsType:    string(ds.Type),
		tables:    []string{},
		structure: make(map[string][]ColumnInfo),
	}

	schema, _ := DeserializeSchemaInfo(ds.SchemaInfo)
	tables, _ := schema["tables"].([]string)
	structure, _ := schema["structure"].(map[string]interface{})

	for _, table := range tables {
		ctx.tables = append(ctx.tables, table)
		var cols []ColumnInfo
		if colsRaw, ok := structure[table].([]interface{}); ok {
			for _, col := range colsRaw {
				if colMap, ok := col.(map[string]interface{}); ok {
					cols = append(cols, ColumnInfo{
						Field:    getString(colMap, "field"),
						Type:     getString(colMap, "type"),
						Nullable: getBool(colMap, "nullable"),
						Key:      getString(colMap, "key"),
						HasIndex: getString(colMap, "key") == "PRI" || getString(colMap, "key") == "MUL",
					})
				}
			}
		}
		ctx.structure[table] = cols
	}

	if ds.AIAnalysis != "" {
		ctx.analysis, _ = DeserializeAIAnalysis(ds.AIAnalysis)
	}

	return ctx
}

// generateSQLWithRetry 生成 SQL（带重试机制）
func (s *NL2SQLService) generateSQLWithRetry(question string, ctx *QueryContext) (string, error) {
	systemPrompt := s.buildSQLPrompt(ctx)
	userPrompt := fmt.Sprintf(`【用户问题】
%s

请根据以上信息生成对应的 SQL 查询语句。只输出 SQL，不要任何额外文字。`, question)

	// 最多重试 2 次
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		resp, err := s.llmService.CallLLM("system", systemPrompt, userPrompt)
		if err != nil {
			lastErr = err
			continue
		}

		sql := s.cleanSQL(resp)
		if err := s.validateSQL(sql); err != nil {
			// SQL 无效，追加错误信息重试
			userPrompt += fmt.Sprintf("\n\n【上一条 SQL 无效：%s】，请重新生成。", err.Error())
			lastErr = err
			continue
		}

		return sql, nil
	}

	return "", fmt.Errorf("SQL 生成失败（已重试3次）：%v", lastErr)
}

// buildSQLPrompt 构建 SQL 生成的系统提示词
func (s *NL2SQLService) buildSQLPrompt(ctx *QueryContext) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("你是专业的 SQL 生成助手。根据用户的问题和数据库 schema，生成准确的 SQL 查询。\n\n"))
	sb.WriteString(fmt.Sprintf("## 数据库类型\n%s\n\n", ctx.dsType))

	sb.WriteString(fmt.Sprintf("## Schema（共 %d 张表）\n\n", len(ctx.tables)))
	for _, table := range ctx.tables {
		sb.WriteString(fmt.Sprintf("### %s\n", table))
		cols := ctx.structure[table]
		for _, col := range cols {
			nullable := ""
			if col.Nullable {
				nullable = " NULL"
			}
			key := ""
			if col.Key == "PRI" {
				key = " [PK]"
			} else if col.Key == "MUL" {
				key = " [INDEX]"
			}
			sb.WriteString(fmt.Sprintf("  %s : %s%s%s\n", col.Field, col.Type, nullable, key))
		}
		sb.WriteString("\n")
	}

	// AI 语义分析结果
	if ctx.analysis != nil && len(ctx.analysis.Fields) > 0 {
		sb.WriteString("## AI 语义分析\n")
		for _, f := range ctx.analysis.Fields {
			if f.SemanticType == "metric" || f.SemanticType == "dimension" || f.SemanticType == "time" {
				sb.WriteString(fmt.Sprintf("- %s.%s → 语义: %s | 业务名: %s | 聚合: %s\n",
					f.Table, f.Field, f.SemanticType, f.BusinessName, f.Aggregation))
			}
		}
		sb.WriteString("\n")
	}

	sb.WriteString(`## 重要规则

1. **只生成 SELECT 查询**，禁止 INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE
2. **严格使用 schema 中的表名和字段名**，不要猜测
3. **注意字段类型**：
   - 字符串字段用单引号包裹：WHERE name = '张三'
   - 数值字段不加引号：WHERE amount > 1000
4. **时间处理**：
   - MySQL: DATE(), DATE_FORMAT(), CURDATE(), DATE_SUB()
   - PostgreSQL: DATE(), TO_CHAR(), CURRENT_DATE
   - SQLite: DATE(), strftime()
5. **聚合查询**：GROUP BY 必须包含 SELECT 中的所有非聚合列
6. **结果行数限制**：默认 LIMIT 100
7. **列别名**：使用 AS 给聚合列起中文别名
8. 如果用户询问 Top N，使用 ORDER BY + LIMIT
9. 如果用户询问趋势，使用 GROUP BY 时间字段 + ORDER BY

## 输出格式
只返回 SQL 语句，不要任何解释。不要用 markdown 代码块包裹。
`)

	return sb.String()
}

// cleanSQL 清理 LLM 返回的 SQL
func (s *NL2SQLService) cleanSQL(sql string) string {
	sql = strings.TrimSpace(sql)
	sql = strings.TrimPrefix(sql, "```sql")
	sql = strings.TrimPrefix(sql, "```")
	sql = strings.TrimSuffix(sql, "```")
	sql = strings.TrimSpace(sql)
	return sql
}

// validateSQL 安全检查
func (s *NL2SQLService) validateSQL(sql string) error {
	if sql == "" {
		return fmt.Errorf("SQL 为空")
	}

	upper := strings.ToUpper(strings.TrimSpace(sql))
	dangerous := []string{"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "EXEC", "EXECUTE"}
	for _, op := range dangerous {
		if strings.Contains(upper, op) {
			return fmt.Errorf("禁止执行 %s 操作，仅支持 SELECT 查询", op)
		}
	}

	if !strings.HasPrefix(upper, "SELECT") {
		return fmt.Errorf("仅支持 SELECT 查询语句")
	}

	return nil
}

// formatQueryResult 格式化查询结果
func (s *NL2SQLService) formatQueryResult(question, sql string, rows []map[string]interface{}) string {
	if len(rows) == 0 {
		return "查询结果为空。\n\n可能原因：\n- 指定的时间范围内没有数据\n- 查询条件过于严格\n- 数据库中尚未有相关记录\n\n您可以尝试扩大时间范围或调整查询条件。"
	}

	var sb strings.Builder
	var columns []string
	for col := range rows[0] {
		columns = append(columns, col)
	}

	limit := len(rows)
	if limit > 10 {
		limit = 10
	}

	sb.WriteString(fmt.Sprintf("查询结果（共 %d 条）\n\n", len(rows)))
	if len(rows) > 10 {
		sb.WriteString(fmt.Sprintf("（仅展示前 %d 条，完整结果 %d 条）\n\n", limit, len(rows)))
	}

	sb.WriteString("| " + strings.Join(columns, " | ") + " |\n")
	sb.WriteString("|" + strings.Repeat("---|", len(columns)) + "\n")

	for i := 0; i < limit; i++ {
		row := rows[i]
		vals := make([]string, len(columns))
		for j, col := range columns {
			val := row[col]
			if val == nil {
				vals[j] = "-"
			} else {
				vals[j] = fmt.Sprintf("%v", val)
			}
			if len(vals[j]) > 30 {
				vals[j] = vals[j][:27] + "..."
			}
		}
		sb.WriteString("| " + strings.Join(vals, " | ") + " |\n")
	}

	// 数据洞察
	upperSQL := strings.ToUpper(sql)
	if strings.Contains(upperSQL, "COUNT") || strings.Contains(upperSQL, "SUM") || strings.Contains(upperSQL, "AVG") {
		if len(rows) == 1 {
			sb.WriteString("\n---\n**数据洞察**：查询成功返回了 1 条汇总结果。\n")
		} else {
			sb.WriteString(fmt.Sprintf("\n---\n**数据洞察**：查询成功返回了 %d 个维度的汇总数据。\n", len(rows)))
		}
	}

	if len(rows) > 10 {
		sb.WriteString(fmt.Sprintf("\n提示：完整结果共 %d 条，如需查看更多请调整查询条件。", len(rows)))
	}

	return sb.String()
}

// isDataQuery 检测消息是否包含数据查询意图
func (s *NL2SQLService) isDataQuery(message string) bool {
	queryPatterns := []string{
		"多少", "有多少", "查询", "查看", "统计",
		"销售额", "GMV", "收入", "订单量", "注册量", "用户数",
		"转化率", "点击率", "CTR", "客单价", "ARPU",
		"增长", "同比增长", "环比增长",
		"最大", "最小", "最高", "最低", "最多", "最少",
		"趋势", "走势", "排行", "排名", "top",
		"最近", "今日", "昨日", "本周", "本月", "上月", "今年",
		"日均", "月均", "平均",
		"total", "sum", "count", "avg", "max", "min",
		"revenue", "sales", "order", "user",
		"给我查", "帮我查", "查一下", "看看",
	}

	lower := strings.ToLower(message)
	matchCount := 0
	for _, pattern := range queryPatterns {
		if strings.Contains(lower, strings.ToLower(pattern)) {
			matchCount++
		}
	}
	return matchCount >= 1
}
