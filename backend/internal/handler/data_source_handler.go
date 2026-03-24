package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type DataSourceHandler struct {
	dataSourceService *service.DataSourceService
}

func NewDataSourceHandler(dataSourceService *service.DataSourceService) *DataSourceHandler {
	return &DataSourceHandler{dataSourceService: dataSourceService}
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

	// 隐藏敏感信息
	for i := range dataSources {
		dataSources[i].Password = ""
		dataSources[i].APIToken = ""
	}

	writeJSON(w, http.StatusOK, dataSources)
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

// CreateDataSource POST /api/tenants/{id}/data-sources
func (h *DataSourceHandler) CreateDataSource(w http.ResponseWriter, r *http.Request) {
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
					"error":              "数据库连接失败：" + err.Error(),
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

	// 隐藏敏感信息
	ds.Password = ""
	ds.APIToken = ""

	writeJSON(w, http.StatusCreated, ds)
}

// UpdateDataSource PUT /api/tenants/{id}/data-sources/{dsId}
func (h *DataSourceHandler) UpdateDataSource(w http.ResponseWriter, r *http.Request) {
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
			existing.Password = req.Connection.Password
			existing.SSL = req.Connection.SSL

			if err := h.dataSourceService.TestConnection(existing); err != nil {
				if existing.Type == model.DataSourcePostgreSQL {
					diagnosis := h.dataSourceService.DiagnosePostgreSQLConnection(existing)
					writeJSON(w, http.StatusBadRequest, map[string]interface{}{
						"error":              "数据库连接失败：" + err.Error(),
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
