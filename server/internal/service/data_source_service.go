package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
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
	queryTrim := query
	if len(queryTrim) > 6 {
		queryTrim = queryTrim[:6]
	}

	return nil, fmt.Errorf("查询功能开发中")
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
