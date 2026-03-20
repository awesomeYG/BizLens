package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type SchemaHandler struct {
	dataSourceService *service.DataSourceService
}

func NewSchemaHandler(dataSourceService *service.DataSourceService) *SchemaHandler {
	return &SchemaHandler{dataSourceService: dataSourceService}
}

// GetSchemaContext GET /api/tenants/{id}/data-sources/{dsId}/schema/context
// 获取用于 AI 上下文的 Schema 描述
func (h *SchemaHandler) GetSchemaContext(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-1]

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	ctx, err := h.dataSourceService.GenerateSchemaContext(ds)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成 Schema 上下文失败："+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"schemaContext": ctx,
	})
}

// GetSampleData POST /api/tenants/{id}/data-sources/{dsId}/sample
// 获取表样本数据
type GetSampleDataRequest struct {
	TableName string `json:"tableName"`
	Limit     int    `json:"limit"`
}

func (h *SchemaHandler) GetSampleData(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-2] // /sample 前一个是 ID

	var req GetSampleDataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	data, err := h.dataSourceService.GetSampleData(ds, req.TableName, req.Limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "获取样本数据失败："+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":  data,
		"count": len(data),
	})
}

// ExecuteSQL POST /api/tenants/{id}/data-sources/{dsId}/query
// 执行 SQL 查询
type ExecuteSQLRequest struct {
	SQL string `json:"sql"`
}

func (h *SchemaHandler) ExecuteSQL(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-2] // /query 前一个是 ID

	var req ExecuteSQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	// 执行查询
	results, err := h.dataSourceService.ExecuteQuery(ds, req.SQL)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   err.Error(),
			"sql":     req.SQL,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    results,
		"count":   len(results),
		"sql":     req.SQL,
	})
}

// RepairSQL POST /api/tenants/{id}/data-sources/{dsId}/query/repair
// AI 修复 SQL 错误
type RepairSQLRequest struct {
	SQL       string `json:"sql"`
	LastError string `json:"error"`
}

func (h *SchemaHandler) RepairSQL(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	dsID := parts[len(parts)-2]

	var req RepairSQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求参数错误")
		return
	}

	ds, err := h.dataSourceService.GetDataSource(dsID, tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "数据源不存在")
		return
	}

	// 获取 Schema 上下文
	schemaCtx, _ := h.dataSourceService.GenerateSchemaContext(ds)

	// 调用 AI 修复 SQL
	repairedSQL, explanation, err := repairSQLWithAI(req.SQL, req.LastError, schemaCtx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI 修复失败："+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"originalSQL":  req.SQL,
		"repairedSQL":  repairedSQL,
		"explanation":  explanation,
		"canTryRepair": repairedSQL != "",
	})
}

// repairSQLWithAI 使用 AI 修复 SQL（简化实现）
func repairSQLWithAI(originalSQL, lastError, schemaCtx string) (string, string, error) {
	// 这里应该调用 AI API 来修复 SQL
	// 简化版本：只做基本的错误诊断
	explanation := "SQL 执行失败，建议检查以下几点：\n"
	explanation += "1. 表名是否正确（区分大小写）\n"
	explanation += "2. 字段名是否存在\n"
	explanation += "3. SQL 语法是否符合数据库类型\n"
	explanation += "4. 是否有权限访问该表\n\n"
	explanation += "错误信息：" + lastError

	// 实际实现应该调用 AI API
	return "", explanation, nil
}
