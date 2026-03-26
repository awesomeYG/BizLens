package handler

import (
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"gorm.io/gorm"
)

type IMHandler struct {
	imService *service.IMService
}

func NewIMHandler(imService *service.IMService) *IMHandler {
	return &IMHandler{imService: imService}
}

// parseTenantID 从 JWT context、请求头或路径解析租户 ID
func parseTenantID(r *http.Request) string {
	// 优先从 JWT context 获取（由 Auth 中间件注入）
	if tid := r.Context().Value("tenantID"); tid != nil {
		if s, ok := tid.(string); ok && s != "" {
			return s
		}
	}
	if tid := r.Header.Get("X-Tenant-ID"); tid != "" {
		return tid
	}
	// 从路径解析 /api/tenants/{id}/...
	parts := strings.Split(r.URL.Path, "/")
	for i, p := range parts {
		if p == "tenants" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

// parseTenantIDFromPath 从路径解析 /api/tenants/{id}/...
func parseTenantIDFromPath(r *http.Request) string {
	parts := strings.Split(r.URL.Path, "/")
	for i, p := range parts {
		if p == "tenants" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

// parseTenantIDStrict 对需要强租户一致性的接口做校验：
// - 若 JWT 中 tenantID 与 URL 中 tenantID 同时存在且不一致，则返回 403
// - 其余情况回落到 parseTenantID 的既有解析逻辑
func parseTenantIDStrict(r *http.Request) (string, int, string) {
	pathTenantID := parseTenantIDFromPath(r)
	if jwtTenantID, ok := r.Context().Value("tenantID").(string); ok && jwtTenantID != "" && pathTenantID != "" && jwtTenantID != pathTenantID {
		return "", http.StatusForbidden, "租户不匹配"
	}

	tenantID := parseTenantID(r)
	if tenantID == "" {
		return "", http.StatusBadRequest, "缺少租户 ID"
	}
	return tenantID, 0, ""
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// 204/304 按规范不应包含响应体
	if status == http.StatusNoContent || status == http.StatusNotModified {
		return
	}
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// ListIMConfigs GET /api/tenants/{id}/im-configs
func (h *IMHandler) ListIMConfigs(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	configs, err := h.imService.ListConfigs(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, configs)
}

// GetIMConfig GET /api/tenants/{id}/im-configs/{configId}
func (h *IMHandler) GetIMConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	// 从路径提取 configId: /tenants/{id}/im-configs/{configId}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	configID := parts[len(parts)-1]

	cfg, err := h.imService.GetConfig(tenantID, configID)
	if err != nil {
		writeError(w, http.StatusNotFound, "配置不存在")
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

// CreateIMConfigRequest 创建请求体
type CreateIMConfigRequest struct {
	Type       string `json:"type"`
	Name       string `json:"name"`
	WebhookURL string `json:"webhookUrl"`
	Secret     string `json:"secret,omitempty"`
	Keyword    string `json:"keyword,omitempty"`
	Enabled    bool   `json:"enabled"`
}

// CreateIMConfig POST /api/tenants/{id}/im-configs
func (h *IMHandler) CreateIMConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	var req CreateIMConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.Type == "" || req.Name == "" || req.WebhookURL == "" {
		writeError(w, http.StatusBadRequest, "type, name, webhookUrl 必填")
		return
	}

	cfg := &model.IMConfig{
		Type:       model.IMPlatformType(req.Type),
		Name:       req.Name,
		WebhookURL: req.WebhookURL,
		Secret:     req.Secret,
		Keyword:    req.Keyword,
		Enabled:    req.Enabled,
	}

	if err := h.imService.CreateConfig(tenantID, cfg); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, cfg)
}

// UpdateIMConfig PUT /api/tenants/{id}/im-configs/{configId}
func (h *IMHandler) UpdateIMConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	configID := parts[len(parts)-1]

	var in service.IMConfigUpdateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	cfg, err := h.imService.UpdateConfig(tenantID, configID, &in)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, http.StatusNotFound, "配置不存在")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, cfg)
}

// DeleteIMConfig DELETE /api/tenants/{id}/im-configs/{configId}
func (h *IMHandler) DeleteIMConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	configID := parts[len(parts)-1]

	if err := h.imService.DeleteConfig(tenantID, configID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// TestIMConfig POST /api/tenants/{id}/im-configs/{configId}/test
func (h *IMHandler) TestIMConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	configID := parts[len(parts)-2] // /test 前一个是 configId

	result, err := h.imService.TestConnection(tenantID, configID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if result.Success {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "连接成功",
		})
	} else {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": false,
			"error":   result.Error,
		})
	}
}

// SendNotificationRequest 发送通知请求体
type SendNotificationRequest struct {
	PlatformIDs []string `json:"platformIds"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Markdown    bool     `json:"markdown"`
}

// SendNotification POST /api/tenants/{id}/notifications/send
func (h *IMHandler) SendNotification(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	var req SendNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if len(req.PlatformIDs) == 0 || req.Content == "" {
		writeError(w, http.StatusBadRequest, "platformIds 和 content 必填")
		return
	}

	records, err := h.imService.SendNotification(
		tenantID,
		req.PlatformIDs,
		req.Title,
		req.Content,
		req.Markdown,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"records": records,
	})
}

// SendIMMessageRequest 内部发送 IM 消息请求体（供 AI Tool Calling 调用）
type SendIMMessageRequest struct {
	TenantID string `json:"tenantId"`
	Platform string `json:"platform"` // 平台名：dingtalk/feishu/wecom/slack/telegram/discord，AI 根据用户需求选择
	Content  string `json:"content"`
	Markdown bool   `json:"markdown"`
}

// platformDisplayNames 平台显示名称映射
var platformDisplayNames = map[string]string{
	"dingtalk": "钉钉",
	"feishu":   "飞书",
	"wecom":    "企业微信",
	"slack":    "Slack",
	"telegram": "Telegram",
	"discord":  "Discord",
}

// SendIMMessage POST /internal/send-im
// AI 通过 Tool Calling 调用的内部接口，自动查找已启用的目标平台配置并发送消息
func (h *IMHandler) SendIMMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "仅支持 POST")
		return
	}

	var req SendIMMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}

	if req.TenantID == "" || req.Content == "" {
		writeError(w, http.StatusBadRequest, "tenantId 和 content 必填")
		return
	}

	platform := strings.TrimSpace(strings.ToLower(req.Platform))
	if platform == "" {
		writeError(w, http.StatusBadRequest, "platform 必填（如 dingtalk/feishu/wecom/slack/telegram/discord）")
		return
	}

	// 查找已启用的目标平台配置
	configs, err := h.imService.ListConfigs(req.TenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var targetCfg *model.IMConfig
	for i := range configs {
		if configs[i].Enabled && strings.EqualFold(string(configs[i].Type), platform) {
			targetCfg = &configs[i]
			break
		}
	}

	if targetCfg == nil {
		displayName := platformDisplayNames[platform]
		if displayName == "" {
			displayName = platform
		}
		writeError(w, http.StatusNotFound, "未找到已启用的"+displayName+"配置")
		return
	}

	records, err := h.imService.SendNotification(
		req.TenantID,
		[]string{targetCfg.ID},
		"",
		req.Content,
		req.Markdown,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	record := records[0]
	if record.Status == model.NotifySent {
		displayName := platformDisplayNames[platform]
		if displayName == "" {
			displayName = platform
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":  true,
			"message":  "消息已发送到" + displayName,
			"platform": displayName,
		})
	} else {
		writeError(w, http.StatusInternalServerError, record.Error)
	}
}

// ListNotifications GET /api/tenants/{id}/notifications
func (h *IMHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	tenantID, code, msg := parseTenantIDStrict(r)
	if code != 0 {
		writeError(w, code, msg)
		return
	}

	records, err := h.imService.ListNotifications(tenantID, 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, records)
}
