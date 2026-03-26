package service

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"ai-bi-server/internal/model"
)

// ChatAIService AI 对话服务：处理 NL -> SQL 查询
type ChatAIService struct {
	db                *gorm.DB
	llmService        *LLMService
	dataSourceService *DataSourceService
}

// NewChatAIService 创建 AI 对话服务
func NewChatAIService(db *gorm.DB, llmService *LLMService, dataSourceService *DataSourceService) *ChatAIService {
	return &ChatAIService{
		db,
		llmService,
		dataSourceService,
	}
}

// SendMessage 处理用户消息，返回 AI 响应
// 流程：保存用户消息 -> 检测是否为数据查询 -> NL -> SQL -> 执行 -> 保存 AI 响应
func (s *ChatAIService) SendMessage(tenantID, userID, conversationID, userMessage, dataSourceID string) (*ChatConversationDetailDTO, error) {
	// 1. 验证会话存在
	var conversation model.ChatConversation
	if err := s.db.Where("id = ? AND tenant_id = ? AND user_id = ?", conversationID, tenantID, userID).First(&conversation).Error; err != nil {
		return nil, fmt.Errorf("会话不存在: %w", err)
	}

	// 2. 保存用户消息
	userMsg := model.ChatConversationMessage{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		TenantID:       tenantID,
		Role:           "user",
		Content:        userMessage,
		OccurredAt:     time.Now(),
	}
	if err := s.db.Create(&userMsg).Error; err != nil {
		return nil, fmt.Errorf("保存用户消息失败: %w", err)
	}

	// 3. 检测是否为数据查询问题
	if !s.isDataQuery(userMessage) {
		// 非数据查询，生成友好提示
		aiContent := "您好！我是 AI-BI 智能助手。我可以帮您：\n\n" +
			"1. 查询数据：直接用自然语言问我，比如\"本月销售额是多少\"、\"订单量同比增长了多少\"\n" +
			"2. 分析趋势：比如\"最近7天的用户注册趋势\"\n" +
			"3. 指标对比：比如\"对比各渠道的转化率\"\n\n" +
			"请告诉我您想查询什么数据？"
		return s.saveAIResponse(tenantID, conversationID, aiContent)
	}

	// 4. 解析并执行数据查询
	result, err := s.processDataQuery(tenantID, userMessage, conversationID, dataSourceID)
	if err != nil {
		// 查询失败，返回错误信息
		aiContent := fmt.Sprintf("查询过程中遇到问题：%s\n\n请尝试换一种方式描述您的问题，或者告诉我您想查询的具体数据指标。", err.Error())
		aiResult, saveErr := s.saveAIResponse(tenantID, conversationID, aiContent)
		if saveErr != nil {
			return nil, saveErr
		}
		return aiResult, nil
	}

	// 5. 保存 AI 响应
	return s.saveAIResponse(tenantID, conversationID, result)
}

// isDataQuery 检测消息是否包含数据查询意图
func (s *ChatAIService) isDataQuery(message string) bool {
	// 关键词检测（中文 + 英文）
	queryPatterns := []string{
		"多少", "多少个", "有多少", "查询", "查看", "统计",
		"销售额", "GMV", "收入", "订单量", "注册量", "用户数",
		"转化率", "点击率", "CTR", "客单价", "ARPU",
		"增长", "增长了多少", "同比增长", "环比增长",
		"最大", "最小", "最高", "最低", "最多", "最少",
		"趋势", "走势", "排行", "排名", "top",
		"最近", "今日", "昨日", "本周", "本月", "上月", "今年",
		"日均", "月均", "平均",
		"total", "sum", "count", "avg", "max", "min",
		"revenue", "sales", "order", "user", "customer",
		"给我查", "帮我查", "查一下", "看看",
	}

	lower := strings.ToLower(message)
	matchCount := 0
	for _, pattern := range queryPatterns {
		if strings.Contains(lower, strings.ToLower(pattern)) {
			matchCount++
		}
	}

	// 至少匹配 1 个查询关键词
	return matchCount >= 1
}

// processDataQuery 处理数据查询：NL -> SQL -> 执行 -> 返回结果
func (s *ChatAIService) processDataQuery(tenantID, userMessage, conversationID, dataSourceID string) (string, error) {
	// 4a. 确定数据源
	ds, err := s.resolveDataSource(tenantID, dataSourceID)
	if err != nil {
		return "", fmt.Errorf("未找到可用的数据源：请先在设置中添加并同步数据库")
	}

	// 4b. 构建查询上下文（schema + AI 分析结果）
	context := s.buildQueryContext(ds, conversationID)

	// 4c. 调用 LLM 生成 SQL
	sql, err := s.generateSQL(tenantID, userMessage, context)
	if err != nil {
		return "", fmt.Errorf("SQL 生成失败：%s", err.Error())
	}

	// 4d. 安全检查
	if err := s.validateSQL(sql); err != nil {
		return "", err
	}

	// 4e. 执行 SQL
	rows, err := s.dataSourceService.ExecuteQuery(ds, sql)
	if err != nil {
		return "", fmt.Errorf("执行失败：%s", err.Error())
	}

	// 4f. 格式化结果
	return s.formatQueryResult(userMessage, sql, rows), nil
}

// resolveDataSource 确定要查询的数据源
func (s *ChatAIService) resolveDataSource(tenantID, dataSourceID string) (*model.DataSource, error) {
	if dataSourceID != "" {
		return s.dataSourceService.GetDataSource(dataSourceID, tenantID)
	}

	// 没有指定数据源，查找该租户的第一个已连接的
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

// buildQueryContext 构建 NL -> SQL 的 prompt 上下文
func (s *ChatAIService) buildQueryContext(ds *model.DataSource, conversationID string) string {
	var sb strings.Builder

	// 数据源信息
	sb.WriteString(fmt.Sprintf("【数据源】%s（%s）\n\n", ds.Name, ds.Type))

	// 表结构
	schema, _ := DeserializeSchemaInfo(ds.SchemaInfo)
	tables, _ := schema["tables"].([]string)
	structure, _ := schema["structure"].(map[string]interface{})

	sb.WriteString(fmt.Sprintf("【数据库 Schema】（共 %d 张表）\n\n", len(tables)))
	for _, table := range tables {
		sb.WriteString(fmt.Sprintf("## %s\n", table))
		if cols, ok := structure[table].([]interface{}); ok {
			for _, col := range cols {
				if colMap, ok := col.(map[string]interface{}); ok {
					field := getString(colMap, "field")
					colType := getString(colMap, "type")
					nullable := "NULL"
					if getBool(colMap, "nullable") {
						nullable = "NOT NULL"
					}
					key := ""
					if k, ok := colMap["key"].(string); ok && k == "PRI" {
						key = " [PK]"
					}
					sb.WriteString(fmt.Sprintf("  - %s : %s %s%s\n", field, colType, nullable, key))
				}
			}
		}
		sb.WriteString("\n")
	}

	// AI 语义分析结果（如果有）
	if ds.AIAnalysis != "" {
		analysis, _ := DeserializeAIAnalysis(ds.AIAnalysis)
		if analysis != nil && len(analysis.Fields) > 0 {
			sb.WriteString("\n【AI 语义分析结果】\n")
			for _, f := range analysis.Fields {
				if f.SemanticType == "metric" || f.SemanticType == "dimension" || f.SemanticType == "time" {
					sb.WriteString(fmt.Sprintf("- %s.%s → 语义类型: %s | 业务名: %s | 聚合: %s\n",
						f.Table, f.Field, f.SemanticType, f.BusinessName, f.Aggregation))
				}
			}
		}
	}

	return sb.String()
}

// generateSQL 调用 LLM 生成 SQL
func (s *ChatAIService) generateSQL(tenantID, userMessage, context string) (string, error) {
	systemPrompt := `你是一个专业的 SQL 生成助手。根据用户的问题和数据库 schema，生成准确的 SQL 查询。

## 重要规则

1. **只生成 SELECT 查询**，不要生成 INSERT/UPDATE/DELETE/DROP 等任何修改数据的 SQL
2. **只使用 FROM 和 JOIN**，不要假设任何视图（VIEW）存在
3. **严格使用 schema 中存在的表名和字段名**，不要猜测
4. **注意字段类型**：字符串字段用引号包裹，数值字段不要加引号
5. **时间处理**：MySQL 用 DATE()、DATE_FORMAT()；PostgreSQL 用 DATE()、TO_CHAR()；SQLite 用 DATE()
6. **聚合查询**：GROUP BY 必须在 SELECT 中出现（MySQL 严格模式下）
7. **结果行数限制**：默认 LIMIT 100，防止返回过多数据
8. **列别名**：使用 AS 给聚合列起中文别名，便于理解

## 输出格式

只返回 SQL 语句，不要任何解释。不要用 markdown 代码块包裹。
`

	userPrompt := fmt.Sprintf(`【用户问题】
%s

【数据库上下文】
%s

请根据以上信息生成对应的 SQL 查询语句。只输出 SQL，不要任何额外文字。`, userMessage, context)

	resp, err := s.llmService.CallLLM(tenantID, systemPrompt, userPrompt)
	if err != nil {
		return "", fmt.Errorf("LLM 调用失败: %w", err)
	}

	// 清理 LLM 返回（可能有 markdown 包裹）
	sql := strings.TrimSpace(resp)
	sql = strings.TrimPrefix(sql, "```sql")
	sql = strings.TrimPrefix(sql, "```")
	sql = strings.TrimSuffix(sql, "```")
	sql = strings.TrimSpace(sql)

	return sql, nil
}

// validateSQL 安全检查
func (s *ChatAIService) validateSQL(sql string) error {
	upper := strings.ToUpper(strings.TrimSpace(sql))

	dangerous := []string{"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE"}
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

// formatQueryResult 格式化查询结果为友好文本
func (s *ChatAIService) formatQueryResult(userMessage, sql string, rows []map[string]interface{}) string {
	if len(rows) == 0 {
		return "查询结果为空。\n\n可能的原因：\n- 指定的时间范围内没有数据\n- 查询条件过于严格\n- 数据库中尚未有相关记录\n\n您可以尝试扩大时间范围或调整查询条件。"
	}

	var sb strings.Builder

	// 提取列名
	var columns []string
	for col := range rows[0] {
		columns = append(columns, col)
	}

	// 如果有列别名，尝试用更友好的名字
	friendlyColumns := make([]string, len(columns))
	copy(friendlyColumns, columns)

	// 生成摘要
	sb.WriteString(fmt.Sprintf("查询结果（共 %d 条）\n\n", len(rows)))

	// 展示前 10 条
	limit := len(rows)
	if limit > 10 {
		limit = 10
		sb.WriteString(fmt.Sprintf("（仅展示前 %d 条，完整结果 %d 条）\n\n", limit, len(rows)))
	}

	// 表格输出
	sb.WriteString("| " + strings.Join(friendlyColumns, " | ") + " |\n")
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
			// 截断过长值
			if len(vals[j]) > 30 {
				vals[j] = vals[j][:27] + "..."
			}
		}
		sb.WriteString("| " + strings.Join(vals, " | ") + " |\n")
	}

	// 如果是聚合查询，给出数据洞察
	if len(rows) > 0 && strings.Contains(strings.ToUpper(sql), "COUNT") ||
		strings.Contains(strings.ToUpper(sql), "SUM") ||
		strings.Contains(strings.ToUpper(sql), "AVG") {
		sb.WriteString("\n---\n**数据洞察**：查询成功返回了 ")
		if len(rows) == 1 {
			sb.WriteString(fmt.Sprintf("1 条汇总结果。\n"))
		} else {
			sb.WriteString(fmt.Sprintf("%d 个维度的汇总数据。\n", len(rows)))
		}
	}

	// 如果结果被截断
	if len(rows) > 10 {
		sb.WriteString(fmt.Sprintf("\n提示：完整结果共 %d 条，如需查看更多请调整查询条件。", len(rows)))
	}

	return sb.String()
}

// saveAIResponse 保存 AI 响应消息到数据库
func (s *ChatAIService) saveAIResponse(tenantID, conversationID, content string) (*ChatConversationDetailDTO, error) {
	// 保存 AI 消息
	aiMsg := model.ChatConversationMessage{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		TenantID:       tenantID,
		Role:           "assistant",
		Content:        content,
		OccurredAt:     time.Now(),
	}
	if err := s.db.Create(&aiMsg).Error; err != nil {
		return nil, fmt.Errorf("保存 AI 响应失败: %w", err)
	}

	// 更新会话最后消息时间
	now := time.Now()
	s.db.Model(&model.ChatConversation{}).Where("id = ?", conversationID).Updates(map[string]interface{}{
		"last_message_at": now,
	})

	// 返回完整对话
	var messages []model.ChatConversationMessage
	s.db.Where("conversation_id = ?", conversationID).Order("sort_order ASC, occurred_at ASC").Find(&messages)

	items := make([]ChatConversationMessageDTO, 0, len(messages))
	for _, m := range messages {
		items = append(items, ChatConversationMessageDTO{
			ID:        m.ID,
			Role:      m.Role,
			Content:   m.Content,
			Timestamp: m.OccurredAt.UnixMilli(),
		})
	}

	var conversation model.ChatConversation
	s.db.Where("id = ?", conversationID).First(&conversation)

	return &ChatConversationDetailDTO{
		ID:            conversation.ID,
		Title:         conversation.Title,
		CreatedAt:     conversation.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     conversation.UpdatedAt.Format(time.RFC3339),
		LastMessageAt: formatTimePtr(conversation.LastMessageAt),
		Messages:      items,
	}, nil
}

// GetConversationWithMessages 获取会话及其所有消息（不含 AI 处理）
func (s *ChatAIService) GetConversation(tenantID, userID, conversationID string) (*ChatConversationDetailDTO, error) {
	var conversation model.ChatConversation
	if err := s.db.Where("id = ? AND tenant_id = ? AND user_id = ?", conversationID, tenantID, userID).First(&conversation).Error; err != nil {
		return nil, err
	}

	var messages []model.ChatConversationMessage
	s.db.Where("conversation_id = ?", conversationID).Order("sort_order ASC, occurred_at ASC").Find(&messages)

	items := make([]ChatConversationMessageDTO, 0, len(messages))
	for _, m := range messages {
		items = append(items, ChatConversationMessageDTO{
			ID:        m.ID,
			Role:      m.Role,
			Content:   m.Content,
			Timestamp: m.OccurredAt.UnixMilli(),
		})
	}

	return &ChatConversationDetailDTO{
		ID:            conversation.ID,
		Title:         conversation.Title,
		CreatedAt:     conversation.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     conversation.UpdatedAt.Format(time.RFC3339),
		LastMessageAt: formatTimePtr(conversation.LastMessageAt),
		Messages:      items,
	}, nil
}

// detectTimeRange 简单的时间范围检测（备用，不依赖 AI）
func (s *ChatAIService) detectTimeRange(message string) string {
	lower := strings.ToLower(message)
	timePatterns := map[string]string{
		"今天":    "DATE(created_at) = CURDATE()",
		"昨日":    "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
		"昨天":    "DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)",
		"近7天":   "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
		"最近7天":  "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
		"近30天":  "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
		"最近30天": "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
		"本月":    "YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())",
		"上月":    "YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))",
	}

	for keyword, condition := range timePatterns {
		if strings.Contains(lower, keyword) {
			return condition
		}
	}
	return ""
}

// removeEmoji 移除表情符号（用于关键词检测）
func removeEmoji(s string) string {
	re := regexp.MustCompile(`[\x{1F600}-\x{1F6FF}]`)
	return re.ReplaceAllString(s, "")
}

// SerializeQueryResult 将查询结果序列化为 JSON（供前端图表使用）
type QueryResultData struct {
	SQL      string                   `json:"sql"`
	RowCount int                      `json:"rowCount"`
	Columns  []string                 `json:"columns"`
	Rows     []map[string]interface{} `json:"rows"`
	Summary  string                   `json:"summary,omitempty"`
}

func (s *ChatAIService) SerializeQueryResult(sql string, rows []map[string]interface{}) *QueryResultData {
	columns := []string{}
	if len(rows) > 0 {
		for col := range rows[0] {
			columns = append(columns, col)
		}
	}
	return &QueryResultData{
		SQL:      sql,
		RowCount: len(rows),
		Columns:  columns,
		Rows:     rows,
	}
}

func SerializeQueryResult(sql string, rows []map[string]interface{}) *QueryResultData {
	columns := []string{}
	if len(rows) > 0 {
		for col := range rows[0] {
			columns = append(columns, col)
		}
	}
	return &QueryResultData{
		SQL:      sql,
		RowCount: len(rows),
		Columns:  columns,
		Rows:     rows,
	}
}

// MarshalJSON 实现自定义序列化（兼容前端消息格式）
type ChatMessageWithData struct {
	ID        string           `json:"id"`
	Role      string           `json:"role"`
	Content   string           `json:"content"`
	Timestamp int64            `json:"timestamp"`
	Data      *QueryResultData `json:"data,omitempty"`
}

func BuildChatMessages(messages []model.ChatConversationMessage, queryData *QueryResultData) []ChatMessageWithData {
	items := make([]ChatMessageWithData, 0, len(messages))
	for i, m := range messages {
		item := ChatMessageWithData{
			ID:        m.ID,
			Role:      m.Role,
			Content:   m.Content,
			Timestamp: m.OccurredAt.UnixMilli(),
		}
		// 最后一assistant 消息附加结构化数据
		if m.Role == "assistant" && i == len(messages)-1 && queryData != nil {
			item.Data = queryData
		}
		items = append(items, item)
	}
	return items
}
