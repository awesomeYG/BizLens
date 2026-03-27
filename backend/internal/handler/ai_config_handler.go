package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

type AIConfigHandler struct {
	aiConfigService *service.AIConfigService
}

func NewAIConfigHandler(aiConfigService *service.AIConfigService) *AIConfigHandler {
	return &AIConfigHandler{aiConfigService: aiConfigService}
}

type upsertAIConfigRequest struct {
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl"`
	ModelType string `json:"modelType"`
	Model     string `json:"model"`
}

type aiConfigResponse struct {
	TenantID  string `json:"tenantId"`
	ModelType string `json:"modelType"`
	Model     string `json:"model"`
	BaseURL   string `json:"baseUrl"`
	APIKey    string `json:"apiKey,omitempty"`
	HasAPIKey bool   `json:"hasApiKey"`
	MaskedKey string `json:"maskedApiKey,omitempty"`
	UpdatedAt string `json:"updatedAt"`
}

func maskAPIKey(value string) string {
	if len(value) <= 8 {
		return "********"
	}
	return value[:4] + "****" + value[len(value)-4:]
}

func shouldIncludeAPIKey(r *http.Request) bool {
	internalToken := strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN"))
	if internalToken == "" {
		return false
	}
	reqToken := strings.TrimSpace(r.Header.Get("X-Internal-Token"))
	return reqToken != "" && reqToken == internalToken
}

func (h *AIConfigHandler) GetAIConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	cfg, err := h.aiConfigService.GetOrInitConfig(tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp := aiConfigResponse{
		TenantID:  cfg.TenantID,
		ModelType: cfg.ModelType,
		Model:     cfg.Model,
		BaseURL:   cfg.BaseURL,
		HasAPIKey: cfg.APIKey != "",
		UpdatedAt: cfg.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
	if cfg.APIKey != "" {
		resp.MaskedKey = maskAPIKey(cfg.APIKey)
	}
	if cfg.APIKey != "" && shouldIncludeAPIKey(r) {
		resp.APIKey = cfg.APIKey
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AIConfigHandler) UpsertAIConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := parseTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "缺少租户 ID")
		return
	}

	var req upsertAIConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求体解析失败")
		return
	}
	if req.ModelType == "" || req.Model == "" {
		writeError(w, http.StatusBadRequest, "modelType 和 model 必填")
		return
	}

	cfg, err := h.aiConfigService.UpsertConfig(tenantID, req.ModelType, req.Model, req.BaseURL, req.APIKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp := aiConfigResponse{
		TenantID:  cfg.TenantID,
		ModelType: cfg.ModelType,
		Model:     cfg.Model,
		BaseURL:   cfg.BaseURL,
		HasAPIKey: cfg.APIKey != "",
		UpdatedAt: cfg.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
	if cfg.APIKey != "" {
		resp.MaskedKey = maskAPIKey(cfg.APIKey)
	}
	writeJSON(w, http.StatusOK, resp)
}
