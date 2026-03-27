package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type DataSourceHandler struct {
	dataSourceService *service.DataSourceService
	schemaAnalysisSvc *service.SchemaAnalysisService
}

func NewDataSourceHandler(dataSourceService *service.DataSourceService, schemaAnalysisSvc *service.SchemaAnalysisService) *DataSourceHandler {
	return &DataSourceHandler{
		dataSourceService: dataSourceService,
		schemaAnalysisSvc: schemaAnalysisSvc,
	}
}

// ListDataSources GET /api/tenants/{id}/data-sources
func (h *DataSourceHandler) ListDataSources(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	dataSources, err := h.dataSourceService.ListDataSources(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	includeTablesInfo := false
	if v := r.URL.Query().Get("includeTablesInfo"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			includeTablesInfo = b
		} else if v == "1" {
			includeTablesInfo = true
		}
	}

	// 隐藏敏感信息；tablesInfo 默认不返回，避免列表接口过慢导致前端超时/代理断连
	type ColumnInfo struct {
		Field    string `json:"field"`
		Type     string `json:"type"`
		Nullable bool   `json:"nullable"`
	}
	type TableSchema struct {
		Name        string       `json:"name"`
		Columns     []ColumnInfo `json:"columns"`
		RecordCount int          `json:"recordCount"`
	}

	responses := make([]map[string]interface{}, 0, len(dataSources))
	for _, ds := range dataSources {
		item := map[string]interface{}{
			"id":          ds.ID,
			"tenantId":    ds.TenantID,
			"type":        ds.Type,
			"name":        ds.Name,
			"description": ds.Description,
			"host":        ds.Host,
			"port":        ds.Port,
			"database":    ds.Database,
			"username":    ds.Username,
			"ssl":         ds.SSL,
			"status":      ds.Status,
			"lastSyncAt":  ds.LastSyncAt,
		}

		// tablesInfo 为可选字段：仅在 includeTablesInfo=true 时附加，避免返回体过大/解析耗时
		if includeTablesInfo && ds.SchemaInfo != "" {
			schema, err := service.DeserializeSchemaInfo(ds.SchemaInfo)
			if err == nil {
				tables, _ := schema["tables"].([]interface{})
				structure, _ := schema["structure"].(map[string]interface{})

				tableSchemas := make([]TableSchema, 0, len(tables))
				for _, t := range tables {
					tableName, ok := t.(string)
					if !ok {
						continue
					}
					cols := make([]ColumnInfo, 0)
					if colList, ok := structure[tableName].([]interface{}); ok {
						for _, col := range colList {
							if colMap, ok := col.(map[string]interface{}); ok {
								field, _ := colMap["field"].(string)
								dataType, _ := colMap["type"].(string)
								nullable, _ := colMap["nullable"].(bool)
								cols = append(cols, ColumnInfo{
									Field:    field,
									Type:     dataType,
									Nullable: nullable,
								})
							}
						}
					}
					tableSchemas = append(tableSchemas, TableSchema{
						Name:        tableName,
						Columns:     cols,
						RecordCount: 0, // recordCount 延迟到详情接口获取，避免列表页阻塞
					})
				}
				item["tablesInfo"] = tableSchemas
			}
		}

		// 隐藏敏感信息
		item["password"] = ""
		item["apiToken"] = ""

		responses = append(responses, item)
	}

	writeJSON(w, http.StatusOK, responses)
}

// GetDataSource GET /api/tenants/{id}/data-sources/{dsId}
func (h *DataSourceHandler) GetDataSource(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	// 隐藏敏感信息
	ds.Password = ""
	ds.APIToken = ""

	writeJSON(w, http.StatusOK, ds)
}

// CreateDataSourceRequest 创建数据源请求体
type CreateDataSourceRequest struct {
	Type        string                `json:"type"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Connection  *DatabaseConnection   `json:"connection,omitempty"`
	APIConfig   *APIDataSourceConfig  `json:"apiConfig,omitempty"`
	FileConfig  *FileDataSourceConfig `json:"fileConfig,omitempty"`
}

type DatabaseConnection struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	SSL      bool   `json:"ssl,omitempty"`
}

type APIDataSourceConfig struct {
	URL       string            `json:"url"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers,omitempty"`
	AuthType  string            `json:"authType,omitempty"`
	AuthToken string            `json:"authToken,omitempty"`
}

type FileDataSourceConfig struct {
	FileName   string `json:"fileName"`
	FileSize   int64  `json:"fileSize"`
	Content    string `json:"content"` // Base64 编码的文件内容
	UploadedAt int64  `json:"uploadedAt"`
}

// checkAdminPermission 检查是否为超管用户
func (h *DataSourceHandler) checkAdminPermission(r *http.Request) bool {
	email := r.Context().Value("userEmail")
	if email == nil {
		return false
	}
	return email.(string) == "koala@qq.com"
}

// CreateDataSource POST /api/tenants/{id}/data-sources
func (h *DataSourceHandler) CreateDataSource(w http.ResponseWriter, r *http.Request) {
	if !h.checkAdminPermission(r) {
		writeError(w, http.StatusForbidden, "只有管理员可以创建数据源")
		return
	}

	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req CreateDataSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	// 验证必填字段
	if req.Type == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "数据源类型和名称为必填项")
		return
	}

	ds := &model.DataSource{
		TenantID:    tenantID,
		Type:        model.DataSourceType(req.Type),
		Name:        req.Name,
		Description: req.Description,
		Status:      model.DSStatusDisconnected,
	}

	// 根据数据源类型设置配置
	switch ds.Type {
	case model.DataSourceMySQL, model.DataSourcePostgreSQL:
		if req.Connection == nil {
			writeError(w, http.StatusBadRequest, "数据库连接配置不能为空")
			return
		}
		ds.Host = req.Connection.Host
		ds.Port = req.Connection.Port
		ds.Database = req.Connection.Database
		ds.Username = req.Connection.Username
		ds.Password = req.Connection.Password
		ds.SSL = req.Connection.SSL

		// 测试连接
		if err := h.dataSourceService.TestConnection(ds); err != nil {
			if ds.Type == model.DataSourcePostgreSQL {
				diagnosis := h.dataSourceService.DiagnosePostgreSQLConnection(ds)
				writeJSON(w, http.StatusBadRequest, map[string]interface{}{
					"error":               "数据库连接失败：" + err.Error(),
					"connectionDiagnosis": diagnosis,
				})
				return
			}
			writeError(w, http.StatusBadRequest, "数据库连接失败："+err.Error())
			return
		}

		// 获取 schema 信息
		schema, err := h.dataSourceService.FetchSchema(ds)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "获取表结构失败："+err.Error())
			return
		}

		schemaJSON, err := service.SerializeSchemaInfo(schema)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "序列化表结构失败")
			return
		}
		ds.SchemaInfo = schemaJSON

		// 提取表名列表
		if tables, ok := schema["tables"].([]string); ok {
			tablesJSON, _ := json.Marshal(tables)
			ds.TableInfo = string(tablesJSON)
		}

		ds.Status = model.DSStatusConnected
		now := time.Now()
		ds.LastSyncAt = &now

	case model.DataSourceAPI:
		if req.APIConfig == nil {
			writeError(w, http.StatusBadRequest, "API 配置不能为空")
			return
		}
		ds.APIURL = req.APIConfig.URL
		ds.APIMethod = req.APIConfig.Method
		ds.APIToken = req.APIConfig.AuthToken
		if req.APIConfig.Headers != nil {
			headersJSON, _ := json.Marshal(req.APIConfig.Headers)
			ds.APIHeaders = string(headersJSON)
		}
		ds.Status = model.DSStatusConnected

	case model.DataSourceCSV, model.DataSourceExcel:
		if req.FileConfig == nil {
			writeError(w, http.StatusBadRequest, "文件配置不能为空")
			return
		}
		ds.FileName = req.FileConfig.FileName
		ds.FileSize = req.FileConfig.FileSize
		// 文件内容处理暂时跳过，后续可实现文件上传存储
		ds.Status = model.DSStatusConnected
		now := time.Now()
		ds.LastSyncAt = &now

	default:
		writeError(w, http.StatusBadRequest, "不支持的数据源类型")
		return
	}

	if err := h.dataSourceService.CreateDataSource(ds); err != nil {
		writeError(w, http.StatusInternalServerError, "创建数据源失败")
		return
	}

	// 创建成功后，自动触发 AI Schema 分析（异步，不阻塞响应）
	if ds.SchemaInfo != "" && h.schemaAnalysisSvc != nil {
		go h.triggerSchemaAnalysis(tenantID, ds)
	}

	// 隐藏敏感信息
	ds.Password = ""
	ds.APIToken = ""

	writeJSON(w, http.StatusCreated, ds)
}

// UpdateDataSource PUT /api/tenants/{id}/data-sources/{dsId}
func (h *DataSourceHandler) UpdateDataSource(w http.ResponseWriter, r *http.Request) {
	if !h.checkAdminPermission(r) {
		writeError(w, http.StatusForbidden, "只有管理员可以修改数据源")
		return
	}

	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	existing, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	var req CreateDataSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	// 更新基本信息
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Description != "" {
		existing.Description = req.Description
	}

	// 更新连接配置并重新测试
	switch existing.Type {
	case model.DataSourceMySQL, model.DataSourcePostgreSQL:
		if req.Connection != nil {
			existing.Host = req.Connection.Host
			existing.Port = req.Connection.Port
			existing.Database = req.Connection.Database
			existing.Username = req.Connection.Username
			if req.Connection.Password != "" {
				existing.Password = req.Connection.Password
			}
			existing.SSL = req.Connection.SSL

			if err := h.dataSourceService.TestConnection(existing); err != nil {
				if existing.Type == model.DataSourcePostgreSQL {
					diagnosis := h.dataSourceService.DiagnosePostgreSQLConnection(existing)
					writeJSON(w, http.StatusBadRequest, map[string]interface{}{
						"error":               "数据库连接失败：" + err.Error(),
						"connectionDiagnosis": diagnosis,
					})
					return
				}
				writeError(w, http.StatusBadRequest, "数据库连接失败："+err.Error())
				return
			}

			// 重新获取 schema
			schema, err := h.dataSourceService.FetchSchema(existing)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "获取表结构失败："+err.Error())
				return
			}

			schemaJSON, _ := service.SerializeSchemaInfo(schema)
			existing.SchemaInfo = schemaJSON

			if tables, ok := schema["tables"].([]string); ok {
				tablesJSON, _ := json.Marshal(tables)
				existing.TableInfo = string(tablesJSON)
			}

			existing.Status = model.DSStatusConnected
			now := time.Now()
			existing.LastSyncAt = &now

			// schema 重同步后，重新触发 AI 分析
			if existing.SchemaInfo != "" && h.schemaAnalysisSvc != nil {
				go h.triggerSchemaAnalysis(tenantID, existing)
			}
		}
	}

	if err := h.dataSourceService.UpdateDataSource(existing); err != nil {
		writeError(w, http.StatusInternalServerError, "更新数据源失败")
		return
	}

	// 隐藏敏感信息
	existing.Password = ""
	existing.APIToken = ""

	writeJSON(w, http.StatusOK, existing)
}

// TestDataSourceConnection POST /api/tenants/{id}/data-sources/{dsId}/test
func (h *DataSourceHandler) TestDataSourceConnection(w http.ResponseWriter, r *http.Request) {
	if !h.checkAdminPermission(r) {
		writeError(w, http.StatusForbidden, "只有管理员可以测试数据源连接")
		return
	}

	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-2] // /test 前一个是 ID

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	if err := h.dataSourceService.TestConnection(ds); err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"message": "连接失败：" + err.Error(),
		})
		return
	}

	// 更新状态
	ds.Status = model.DSStatusConnected
	h.dataSourceService.UpdateDataSource(ds)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "连接成功",
	})
}

// DeleteDataSource DELETE /api/tenants/{id}/data-sources/{dsId}
func (h *DataSourceHandler) DeleteDataSource(w http.ResponseWriter, r *http.Request) {
	if !h.checkAdminPermission(r) {
		writeError(w, http.StatusForbidden, "只有管理员可以删除数据源")
		return
	}

	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	if err := h.dataSourceService.DeleteDataSource(dsID, tenantID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除数据源失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "删除成功"})
}

// GetDataSourceSchema GET /api/tenants/{id}/data-sources/{dsId}/schema
func (h *DataSourceHandler) GetDataSourceSchema(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	if ds.SchemaInfo == "" {
		writeError(w, http.StatusNotFound, "暂无表结构信息")
		return
	}

	schema, err := service.DeserializeSchemaInfo(ds.SchemaInfo)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "解析表结构失败")
		return
	}

	writeJSON(w, http.StatusOK, schema)
}

// triggerSchemaAnalysis 异步触发 AI Schema 分析（后台运行）
// 策略：有旧分析时增量更新，无旧分析时全量分析
func (h *DataSourceHandler) triggerSchemaAnalysis(tenantID string, ds *model.DataSource) {
	// 读取旧的 AI 分析结果
	oldAnalysis, _ := service.DeserializeAIAnalysis(ds.AIAnalysis)

	var analysis *model.SchemaAIAnalysis
	var err error

	if oldAnalysis != nil && oldAnalysis.AnalyzedAt != "" {
		// 有旧分析，增量更新：对比 schema 变化，只对新增部分调用 AI
		analysis, _, err = h.schemaAnalysisSvc.IncrementalAnalyzeSchema(tenantID, ds, oldAnalysis)
	} else {
		// 无旧分析，完整分析
		analysis, err = h.schemaAnalysisSvc.AnalyzeSchema(tenantID, ds)
	}

	if err != nil {
		// 静默失败，不影响主流程；分析结果可由用户手动重试
		return
	}

	// 将分析结果序列化并保存到数据源
	analysisJSON, err := service.SerializeAIAnalysis(analysis)
	if err != nil {
		return
	}

	// 更新数据源的 AIAnalysis 字段
	ds.AIAnalysis = analysisJSON
	h.dataSourceService.UpdateDataSource(ds)
}

// AnalyzedSchemaResult AI Schema 分析结果的 API 返回格式
type AnalyzedSchemaResult struct {
	HasAnalysis    bool                `json:"hasAnalysis"`
	AnalyzedAt     string              `json:"analyzedAt,omitempty"`
	ModelUsed      string              `json:"modelUsed,omitempty"`
	FieldCount     int                 `json:"fieldCount"`
	TableCount     int                 `json:"tableCount"`
	MetricCount    int                 `json:"metricCount"`
	DimensionCount int                 `json:"dimensionCount"`
	Diff           *service.SchemaDiff `json:"diff,omitempty"`
}

// GetSchemaAnalysis GET /api/tenants/{id}/data-sources/{dsId}/schema/analysis
// 获取当前 AI 分析状态和 schema 差异预览（不触发分析）
func (h *DataSourceHandler) GetSchemaAnalysis(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	result := AnalyzedSchemaResult{
		HasAnalysis: ds.AIAnalysis != "",
	}

	// 解析已有分析结果
	if ds.AIAnalysis != "" {
		analysis, err := service.DeserializeAIAnalysis(ds.AIAnalysis)
		if err == nil && analysis != nil {
			result.AnalyzedAt = analysis.AnalyzedAt
			result.ModelUsed = analysis.ModelUsed
			result.FieldCount = len(analysis.Fields)
			result.TableCount = len(analysis.Tables)
			result.MetricCount = len(analysis.Recommendations)
			result.DimensionCount = len(analysis.Dimensions)
		}
	}

	// 对比当前 schema 和已有分析，给出差异预览
	if ds.SchemaInfo != "" && ds.AIAnalysis != "" {
		oldAnalysis, _ := service.DeserializeAIAnalysis(ds.AIAnalysis)
		diff := h.schemaAnalysisSvc.DiffSchema(oldAnalysis, ds)
		// 只在有实际变化时返回 diff
		if len(diff.NewTables) > 0 || len(diff.DelTables) > 0 || len(diff.NewFields) > 0 || len(diff.ModFields) > 0 {
			result.Diff = diff
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// AnalyzeSchema POST /api/tenants/{id}/data-sources/{dsId}/schema/analyze
// 手动触发 AI Schema 分析，支持全量重分析或增量更新
type AnalyzeSchemaRequest struct {
	Mode string `json:"mode"` // "full" 强制全量分析，"incremental" 增量更新（默认）
}

func (h *DataSourceHandler) AnalyzeSchema(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	if ds.SchemaInfo == "" {
		writeError(w, http.StatusBadRequest, "请先同步数据库 schema")
		return
	}

	var req AnalyzeSchemaRequest
	if r.ContentLength > 0 {
		json.NewDecoder(r.Body).Decode(&req)
	}

	var analysis *model.SchemaAIAnalysis
	var diff *service.SchemaDiff

	// 判断分析模式
	if req.Mode == "full" {
		// 强制全量重分析
		analysis, err = h.schemaAnalysisSvc.AnalyzeSchema(tenantID, ds)
	} else {
		// 增量更新（默认）
		oldAnalysis, _ := service.DeserializeAIAnalysis(ds.AIAnalysis)
		analysis, diff, err = h.schemaAnalysisSvc.IncrementalAnalyzeSchema(tenantID, ds, oldAnalysis)
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "AI 分析失败：" + err.Error(),
			"message": "请检查 AI 配置（API Key、模型等）是否正确",
		})
		return
	}

	// 保存分析结果
	analysisJSON, err := service.SerializeAIAnalysis(analysis)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存分析结果失败")
		return
	}

	ds.AIAnalysis = analysisJSON
	if err := h.dataSourceService.UpdateDataSource(ds); err != nil {
		writeError(w, http.StatusInternalServerError, "更新数据源失败")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":        true,
		"mode":           req.Mode,
		"analyzedAt":     analysis.AnalyzedAt,
		"modelUsed":      analysis.ModelUsed,
		"fieldCount":     len(analysis.Fields),
		"tableCount":     len(analysis.Tables),
		"metricCount":    len(analysis.Recommendations),
		"dimensionCount": len(analysis.Dimensions),
		"diff":           diff,
	})
}
