package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"ai-bi-server/internal/model"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"gorm.io/gorm"
)

// DataSourceService 数据源服务
type DataSourceService struct {
	db *gorm.DB
}

// NewDataSourceService 创建数据源服务
func NewDataSourceService(db *gorm.DB) *DataSourceService {
	return &DataSourceService{db: db}
}

// ListDataSources 获取租户的所有数据源
func (s *DataSourceService) ListDataSources(tenantID string) ([]model.DataSource, error) {
	var dataSources []model.DataSource
	err := s.db.Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Order("created_at DESC").
		Find(&dataSources).Error
	return dataSources, err
}

// GetDataSource 获取单个数据源
func (s *DataSourceService) GetDataSource(id, tenantID string) (*model.DataSource, error) {
	var ds model.DataSource
	err := s.db.Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&ds).Error
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

// CreateDataSource 创建数据源
func (s *DataSourceService) CreateDataSource(ds *model.DataSource) error {
	return s.db.Create(ds).Error
}

// UpdateDataSource 更新数据源
func (s *DataSourceService) UpdateDataSource(ds *model.DataSource) error {
	return s.db.Save(ds).Error
}

// DeleteDataSource 删除数据源（软删除）
func (s *DataSourceService) DeleteDataSource(id, tenantID string) error {
	return s.db.Where("id = ? AND tenant_id = ?", id, tenantID).
		Delete(&model.DataSource{}).Error
}

// TestConnection 测试数据库连接
func (s *DataSourceService) TestConnection(ds *model.DataSource) error {
	switch ds.Type {
	case model.DataSourceMySQL:
		return s.testMySQLConnection(ds)
	case model.DataSourcePostgreSQL:
		return s.testPostgreSQLConnection(ds)
	default:
		return nil // 其他类型暂不测试
	}
}

// testMySQLConnection 测试 MySQL 连接
func (s *DataSourceService) testMySQLConnection(ds *model.DataSource) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		ds.Username, ds.Password, ds.Host, ds.Port, ds.Database)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("打开连接失败：%w", err)
	}
	defer db.Close()

	// 设置超时
	db.SetConnMaxLifetime(time.Second * 5)

	// 测试连接
	if err := db.Ping(); err != nil {
		return fmt.Errorf("连接失败：%w", err)
	}

	return nil
}

// testPostgreSQLConnection 测试 PostgreSQL 连接
func (s *DataSourceService) testPostgreSQLConnection(ds *model.DataSource) error {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		ds.Host, ds.Port, ds.Username, ds.Password, ds.Database)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("打开连接失败：%w", err)
	}
	defer db.Close()

	// 设置超时
	db.SetConnMaxLifetime(time.Second * 5)

	// 测试连接
	if err := db.Ping(); err != nil {
		return fmt.Errorf("连接失败：%w", err)
	}

	return nil
}

// FetchSchema 获取数据库 schema 信息
func (s *DataSourceService) FetchSchema(ds *model.DataSource) (map[string]interface{}, error) {
	switch ds.Type {
	case model.DataSourceMySQL:
		return s.fetchMySQLSchema(ds)
	case model.DataSourcePostgreSQL:
		return s.fetchPostgreSQLSchema(ds)
	default:
		return nil, fmt.Errorf("不支持的数据源类型：%s", ds.Type)
	}
}

// fetchMySQLSchema 获取 MySQL schema
func (s *DataSourceService) fetchMySQLSchema(ds *model.DataSource) (map[string]interface{}, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		ds.Username, ds.Password, ds.Host, ds.Port, ds.Database)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// 查询所有表
	rows, err := db.Query("SHOW TABLES")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}
		tables = append(tables, tableName)
	}

	// 获取每个表的结构
	tableStructures := make(map[string]interface{})
	for _, table := range tables {
		schemaRows, err := db.Query(fmt.Sprintf("DESCRIBE %s", table))
		if err != nil {
			continue
		}
		defer schemaRows.Close()

		columns := make([]map[string]interface{}, 0)
		for schemaRows.Next() {
			var field, colType, null, key, defaultValue, extra string
			if err := schemaRows.Scan(&field, &colType, &null, &key, &defaultValue, &extra); err != nil {
				continue
			}
			columns = append(columns, map[string]interface{}{
				"field":    field,
				"type":     colType,
				"nullable": null == "YES",
				"key":      key,
				"default":  defaultValue,
				"extra":    extra,
			})
		}
		tableStructures[table] = columns
	}

	return map[string]interface{}{
		"tables":    tables,
		"structure": tableStructures,
	}, nil
}

// fetchPostgreSQLSchema 获取 PostgreSQL schema
func (s *DataSourceService) fetchPostgreSQLSchema(ds *model.DataSource) (map[string]interface{}, error) {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		ds.Host, ds.Port, ds.Username, ds.Password, ds.Database)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// 查询所有表
	rows, err := db.Query(`
		SELECT table_name 
		FROM information_schema.tables 
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			return nil, err
		}
		tables = append(tables, tableName)
	}

	// 获取每个表的结构
	tableStructures := make(map[string]interface{})
	for _, table := range tables {
		schemaRows, err := db.Query(`
			SELECT 
				column_name,
				data_type,
				is_nullable,
				column_default
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1
			ORDER BY ordinal_position
		`, table)
		if err != nil {
			continue
		}
		defer schemaRows.Close()

		columns := make([]map[string]interface{}, 0)
		for schemaRows.Next() {
			var colName, dataType, isNullable string
			var defaultValue sql.NullString
			if err := schemaRows.Scan(&colName, &dataType, &isNullable, &defaultValue); err != nil {
				continue
			}
			columns = append(columns, map[string]interface{}{
				"field":    colName,
				"type":     dataType,
				"nullable": isNullable == "YES",
				"default":  defaultValue.String,
			})
		}
		tableStructures[table] = columns
	}

	return map[string]interface{}{
		"tables":    tables,
		"structure": tableStructures,
	}, nil
}

// ExecuteQuery 执行 SQL 查询（只读）
func (s *DataSourceService) ExecuteQuery(ds *model.DataSource, query string) ([]map[string]interface{}, error) {
	// 安全检查：只允许 SELECT 查询
	queryTrim := strings.TrimSpace(query)
	queryUpper := strings.ToUpper(queryTrim)

	// 禁止危险操作
	dangerous := []string{"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"}
	for _, op := range dangerous {
		if strings.Contains(queryUpper, op) {
			return nil, fmt.Errorf("禁止执行 %s 操作，仅支持 SELECT 查询", op)
		}
	}

	var dbConn *sql.DB
	var err error

	switch ds.Type {
	case model.DataSourceMySQL:
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			ds.Username, ds.Password, ds.Host, ds.Port, ds.Database)
		dbConn, err = sql.Open("mysql", dsn)
	case model.DataSourcePostgreSQL:
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			ds.Host, ds.Port, ds.Username, ds.Password, ds.Database)
		dbConn, err = sql.Open("postgres", dsn)
	default:
		return nil, fmt.Errorf("不支持的数据源类型：%s", ds.Type)
	}

	if err != nil {
		return nil, fmt.Errorf("连接数据库失败：%w", err)
	}
	defer dbConn.Close()

	// 设置超时
	dbConn.SetConnMaxLifetime(time.Second * 30)
	dbConn.SetMaxOpenConns(5)
	dbConn.SetMaxIdleConns(2)

	// 执行查询
	rows, err := dbConn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("执行查询失败：%w", err)
	}
	defer rows.Close()

	// 获取列名
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	// 解析结果
	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		results = append(results, row)
	}

	return results, nil
}

// GetSampleData 获取表样本数据（前 100 行）
func (s *DataSourceService) GetSampleData(ds *model.DataSource, tableName string, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 100
	}

	var query string
	switch ds.Type {
	case model.DataSourceMySQL:
		query = fmt.Sprintf("SELECT * FROM %s LIMIT %d", tableName, limit)
	case model.DataSourcePostgreSQL:
		query = fmt.Sprintf("SELECT * FROM %s LIMIT %d", tableName, limit)
	}

	return s.ExecuteQuery(ds, query)
}

// GetTableCount 获取表记录数
func (s *DataSourceService) GetTableCount(ds *model.DataSource, tableName string) (int64, error) {
	query := fmt.Sprintf("SELECT COUNT(*) as count FROM %s", tableName)
	results, err := s.ExecuteQuery(ds, query)
	if err != nil {
		return 0, err
	}

	if len(results) > 0 {
		if count, ok := results[0]["count"].(int64); ok {
			return count, nil
		}
		if count, ok := results[0]["count"].(float64); ok {
			return int64(count), nil
		}
	}

	return 0, nil
}

// GenerateSchemaContext 生成用于 AI 上下文的 Schema 描述
func (s *DataSourceService) GenerateSchemaContext(ds *model.DataSource) (string, error) {
	if ds.SchemaInfo == "" {
		return "", fmt.Errorf("暂无 Schema 信息")
	}

	schema, err := DeserializeSchemaInfo(ds.SchemaInfo)
	if err != nil {
		return "", err
	}

	tables, _ := schema["tables"].([]interface{})
	structure, _ := schema["structure"].(map[string]interface{})

	var ctx strings.Builder
	ctx.WriteString("## 数据库 Schema 信息\n\n")

	for _, t := range tables {
		tableName := t.(string)
		ctx.WriteString(fmt.Sprintf("### 表：%s\n", tableName))

		// 获取记录数
		count, _ := s.GetTableCount(ds, tableName)
		ctx.WriteString(fmt.Sprintf("记录数：%d\n\n", count))

		// 获取表结构
		if cols, ok := structure[tableName].([]interface{}); ok {
			ctx.WriteString("| 字段 | 类型 | 可空 | 说明 |\n")
			ctx.WriteString("|------|------|------|------|\n")

			for _, col := range cols {
				if colMap, ok := col.(map[string]interface{}); ok {
					field := getString(colMap, "field")
					dataType := getString(colMap, "type")
					nullable := ""
					if getBool(colMap, "nullable") {
						nullable = "是"
					}
					ctx.WriteString(fmt.Sprintf("| %s | %s | %s | |\n", field, dataType, nullable))
				}
			}
			ctx.WriteString("\n")
		}
	}

	return ctx.String(), nil
}

// 辅助函数
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

// SerializeSchemaInfo 序列化 schema 信息为 JSON
func SerializeSchemaInfo(schema map[string]interface{}) (string, error) {
	data, err := json.Marshal(schema)
	return string(data), err
}

// DeserializeSchemaInfo 反序列化 schema 信息
func DeserializeSchemaInfo(data string) (map[string]interface{}, error) {
	var schema map[string]interface{}
	err := json.Unmarshal([]byte(data), &schema)
	return schema, err
}
