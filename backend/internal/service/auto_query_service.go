package service

import (
	"fmt"
	"strings"

	"ai-bi-server/internal/model"
)

// AutoQueryRequest AutoQuery 请求
type AutoQueryRequest struct {
	Question    string                `json:"question"`
	DataSources []AutoQueryDataSource `json:"dataSources"`
}

// AutoQueryDataSource 单个数据源的查询上下文
type AutoQueryDataSource struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	Type       string                 `json:"type"`
	Database   string                 `json:"database"`
	TablesInfo []AutoQueryTableSchema `json:"tablesInfo"`
}

// AutoQueryTableSchema 表结构信息
type AutoQueryTableSchema struct {
	Name        string                `json:"name"`
	Columns     []AutoQueryColumnInfo `json:"columns"`
	RecordCount int                   `json:"recordCount"`
}

// AutoQueryColumnInfo 字段信息
type AutoQueryColumnInfo struct {
	Field    string `json:"field"`
	Type     string `json:"type"`
	Nullable bool   `json:"nullable"`
}

// AutoQueryResult AutoQuery 结果
type AutoQueryResult struct {
	TotalCount    map[string]interface{} `json:"totalCount"`    // 各表记录数 {"tasks": 5234, "users": 127}
	Distributions []QueryDistribution    `json:"distributions"` // 字段分布数据
	TimeTrends    []QueryTimeTrend       `json:"timeTrends"`    // 时间趋势数据
	SampleRows    []QuerySampleRows      `json:"sampleRows"`    // 各表样本行（前5条）
}

// QueryDistribution 字段分布查询结果
type QueryDistribution struct {
	TableName  string                   `json:"tableName"`
	ColumnName string                   `json:"columnName"`
	ColumnType string                   `json:"columnType"`
	QuerySQL   string                   `json:"querySql"`
	Rows       []map[string]interface{} `json:"rows"`
	TopValues  []DistributionValue      `json:"topValues"` // 简化后的 top 值
}

// DistributionValue 分布值
type DistributionValue struct {
	Label string `json:"label"`
	Value int64  `json:"value"`
}

// QueryTimeTrend 时间趋势查询结果
type QueryTimeTrend struct {
	TableName  string                   `json:"tableName"`
	ColumnName string                   `json:"columnName"`
	QuerySQL   string                   `json:"querySql"`
	Rows       []map[string]interface{} `json:"rows"`
}

// QuerySampleRows 样本行数据
type QuerySampleRows struct {
	TableName string                   `json:"tableName"`
	Rows      []map[string]interface{} `json:"rows"`
}

// AutoQueryService 自动查询服务
type AutoQueryService struct {
	dataSourceService *DataSourceService
}

// NewAutoQueryService 创建 AutoQuery 服务
func NewAutoQueryService(dataSourceService *DataSourceService) *AutoQueryService {
	return &AutoQueryService{dataSourceService: dataSourceService}
}

// AutoQuery 根据数据源上下文自动生成并执行聚合查询
func (s *AutoQueryService) AutoQuery(tenantID string, req AutoQueryRequest) (*AutoQueryResult, error) {
	result := &AutoQueryResult{
		TotalCount:    make(map[string]interface{}),
		Distributions: make([]QueryDistribution, 0),
		TimeTrends:    make([]QueryTimeTrend, 0),
		SampleRows:    make([]QuerySampleRows, 0),
	}

	for _, ds := range req.DataSources {
		// 获取数据源模型
		dataSource, err := s.dataSourceService.GetDataSource(ds.ID, tenantID)
		if err != nil || dataSource == nil {
			continue
		}

		for _, table := range ds.TablesInfo {
			if table.Name == "" || table.RecordCount == 0 {
				continue
			}

			// 1. 获取记录总数（用于 KPI）
			count, err := s.dataSourceService.GetTableCount(dataSource, table.Name)
			if err == nil && count > 0 {
				result.TotalCount[table.Name] = count
			}

			// 2. 生成并执行分布查询（每个表最多 2 个分类字段）
			distQueries := s.generateDistributionQueries(ds.Type, table, 2)
			for _, q := range distQueries {
				rows, err := s.dataSourceService.ExecuteQuery(dataSource, q.SQL)
				if err == nil && len(rows) > 0 {
					topValues := s.extractTopValues(rows, q.GroupByColumn)
					result.Distributions = append(result.Distributions, QueryDistribution{
						TableName:  table.Name,
						ColumnName: q.GroupByColumn,
						ColumnType: q.ColumnType,
						QuerySQL:   q.SQL,
						Rows:       rows,
						TopValues:  topValues,
					})
				}
			}

			// 3. 生成并执行时间趋势查询（每个表最多 1 个时间字段）
			trendQuery := s.generateTimeTrendQuery(ds.Type, table)
			if trendQuery != nil {
				rows, err := s.dataSourceService.ExecuteQuery(dataSource, trendQuery.SQL)
				if err == nil && len(rows) > 0 {
					result.TimeTrends = append(result.TimeTrends, QueryTimeTrend{
						TableName:  table.Name,
						ColumnName: trendQuery.TimeColumn,
						QuerySQL:   trendQuery.SQL,
						Rows:       rows,
					})
				}
			}

			// 4. 获取样本行（用于了解数据格式，最多 3 条）
			sampleRows, err := s.getSampleRows(dataSource, ds.Type, table.Name, 3)
			if err == nil && len(sampleRows) > 0 {
				result.SampleRows = append(result.SampleRows, QuerySampleRows{
					TableName: table.Name,
					Rows:      sampleRows,
				})
			}
		}
	}

	return result, nil
}

// generatedQuery 存储生成的查询信息
type generatedQuery struct {
	SQL           string
	GroupByColumn string
	ColumnType    string
}

// timeTrendQuery 存储时间趋势查询信息
type timeTrendQuery struct {
	SQL        string
	TimeColumn string
}

// isNumericType 判断字段类型是否为数值类型
func isNumericType(colType string) bool {
	t := strings.ToLower(colType)
	numericKeywords := []string{"int", "bigint", "smallint", "numeric", "decimal", "float", "double", "real"}
	for _, kw := range numericKeywords {
		if strings.Contains(t, kw) {
			return true
		}
	}
	return false
}

// isTextType 判断字段类型是否为文本类型（适合作为分类维度）
func isTextType(colType string) bool {
	t := strings.ToLower(colType)
	textKeywords := []string{"varchar", "text", "char", "bpchar", "name"}
	for _, kw := range textKeywords {
		if strings.Contains(t, kw) {
			return true
		}
	}
	return false
}

// isTimeType 判断字段类型是否为时间类型
func isTimeType(colType string) bool {
	t := strings.ToLower(colType)
	timeKeywords := []string{"timestamp", "date", "time", "datetime"}
	for _, kw := range timeKeywords {
		if strings.Contains(t, kw) {
			return true
		}
	}
	return false
}

// generateDistributionQueries 为表生成分布查询（分类字段的 GROUP BY）
func (s *AutoQueryService) generateDistributionQueries(dbType string, table AutoQueryTableSchema, maxQueries int) []generatedQuery {
	queries := make([]generatedQuery, 0)

	// 找出适合作为分类维度的字段
	categoricalFields := make([]AutoQueryColumnInfo, 0)
	for _, col := range table.Columns {
		if col.Field == "" || col.Field == "id" || col.Field == "password" || col.Field == "token" {
			continue
		}
		if isTextType(col.Type) && !isNumericType(col.Type) {
			categoricalFields = append(categoricalFields, col)
		}
	}

	// 限制查询数量
	if len(categoricalFields) > maxQueries {
		categoricalFields = categoricalFields[:maxQueries]
	}

	for _, col := range categoricalFields {
		// 跳过可能存储大量唯一值的字段（如 email, url, description 等）
		skipKeywords := []string{"email", "url", "link", "description", "content", "comment", "title", "name"}
		for _, kw := range skipKeywords {
			if strings.Contains(strings.ToLower(col.Field), kw) {
				continue
			}
		}

		safeCol := s.quoteIdentifier(col.Field, dbType)
		safeTable := s.quoteIdentifier(table.Name, dbType)
		limit := 10
		sql := fmt.Sprintf("SELECT %s AS label, COUNT(*) AS value FROM %s GROUP BY %s ORDER BY value DESC LIMIT %d",
			safeCol, safeTable, safeCol, limit)

		queries = append(queries, generatedQuery{
			SQL:           sql,
			GroupByColumn: col.Field,
			ColumnType:    col.Type,
		})
	}

	return queries
}

// generateTimeTrendQuery 为表生成时间趋势查询
func (s *AutoQueryService) generateTimeTrendQuery(dbType string, table AutoQueryTableSchema) *timeTrendQuery {
	// 找出时间类型字段
	var timeCol *AutoQueryColumnInfo
	for _, col := range table.Columns {
		if col.Field == "" || strings.Contains(strings.ToLower(col.Field), "updated_at") {
			continue // 优先找 created_at 而不是 updated_at
		}
		if isTimeType(col.Type) && !strings.Contains(strings.ToLower(col.Field), "update") {
			timeCol = &col
			break
		}
	}

	if timeCol == nil {
		return nil
	}

	safeTable := s.quoteIdentifier(table.Name, dbType)
	safeCol := s.quoteIdentifier(timeCol.Field, dbType)

	var sql string
	switch dbType {
	case "postgresql":
		// PostgreSQL: 按天聚合
		sql = fmt.Sprintf("SELECT DATE(%s) AS period, COUNT(*) AS value FROM %s GROUP BY DATE(%s) ORDER BY period DESC LIMIT 30",
			safeCol, safeTable, safeCol)
	case "mysql":
		// MySQL: 按天聚合
		sql = fmt.Sprintf("SELECT DATE(%s) AS period, COUNT(*) AS value FROM %s GROUP BY DATE(%s) ORDER BY period DESC LIMIT 30",
			safeCol, safeTable, safeCol)
	case "sqlite":
		// SQLite: 按天聚合
		sql = fmt.Sprintf("SELECT DATE(%s) AS period, COUNT(*) AS value FROM %s GROUP BY DATE(%s) ORDER BY period DESC LIMIT 30",
			safeCol, safeTable, safeCol)
	default:
		sql = fmt.Sprintf("SELECT DATE(%s) AS period, COUNT(*) AS value FROM %s GROUP BY DATE(%s) ORDER BY period DESC LIMIT 30",
			safeCol, safeTable, safeCol)
	}

	return &timeTrendQuery{
		SQL:        sql,
		TimeColumn: timeCol.Field,
	}
}

// getSampleRows 获取表样本行
func (s *AutoQueryService) getSampleRows(ds *model.DataSource, dbType, tableName string, limit int) ([]map[string]interface{}, error) {
	safeTable := s.quoteIdentifier(tableName, dbType)
	query := fmt.Sprintf("SELECT * FROM %s LIMIT %d", safeTable, limit)
	return s.dataSourceService.ExecuteQuery(ds, query)
}

// extractTopValues 从分布查询结果中提取 top 值
func (s *AutoQueryService) extractTopValues(rows []map[string]interface{}, groupByCol string) []DistributionValue {
	values := make([]DistributionValue, 0, len(rows))
	for _, row := range rows {
		if len(values) >= 10 {
			break
		}
		label := ""
		var value int64

		if l, ok := row["label"].(string); ok {
			label = l
		}
		switch v := row["value"].(type) {
		case int64:
			value = v
		case float64:
			value = int64(v)
		case int:
			value = int64(v)
		case int32:
			value = int64(v)
		case int8:
			value = int64(v)
		default:
			continue
		}

		if label != "" {
			values = append(values, DistributionValue{Label: label, Value: value})
		}
	}
	return values
}

// quoteIdentifier 安全地引用标识符（表名、列名）
func (s *AutoQueryService) quoteIdentifier(name, dbType string) string {
	switch dbType {
	case "postgresql":
		// PostgreSQL 使用双引号
		return "\"" + strings.ReplaceAll(name, "\"", "\"\"") + "\""
	case "mysql":
		// MySQL 使用反引号
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	case "sqlite":
		// SQLite 使用双引号或方括号
		return "\"" + strings.ReplaceAll(name, "\"", "\"\"") + "\""
	default:
		return "\"" + name + "\""
	}
}
