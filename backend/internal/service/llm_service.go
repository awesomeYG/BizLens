package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"ai-bi-server/internal/model"
)

const missingAPIKeyMessage = "AI 配置未填写 API Key，请先到设置页完成 AI 配置后再重试"

// ErrAIConfigMissingAPIKey 表示租户未配置 LLM API Key
var ErrAIConfigMissingAPIKey = errors.New("ai config missing api key")

// LLMService 统一 LLM 调用服务
type LLMService struct {
	aiConfigService *AIConfigService
	httpClient      *http.Client
}

// NewLLMService 创建 LLM 服务
func NewLLMService(aiConfigService *AIConfigService) *LLMService {
	return &LLMService{
		aiConfigService: aiConfigService,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// LLMRequest LLM API 请求
type LLMRequest struct {
	Model       string       `json:"model"`
	Messages    []LLMMessage `json:"messages"`
	Temperature float64      `json:"temperature,omitempty"`
	MaxTokens   int          `json:"max_tokens,omitempty"`
	Stream      bool         `json:"stream,omitempty"`
}

// LLMMessage LLM 消息
type LLMMessage struct {
	Role    string `json:"role"` // system/user/assistant
	Content string `json:"content"`
}

// LLMResponse LLM API 响应
type LLMResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage,omitempty"`
}

// Choice LLM 响应选项
type Choice struct {
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

// Message 消息内容
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Usage token 使用量
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// CallLLM 调用 LLM（通用接口）
func (s *LLMService) CallLLM(tenantID string, systemPrompt, userPrompt string) (string, error) {
	cfg, err := s.aiConfigService.GetOrInitConfig(tenantID)
	if err != nil {
		return "", fmt.Errorf("failed to get AI config: %w", err)
	}

	return s.CallLLMWithModel(cfg, systemPrompt, userPrompt)
}

// CallLLMWithModel 使用指定配置调用 LLM
func (s *LLMService) CallLLMWithModel(cfg *model.AIServiceConfig, systemPrompt, userPrompt string) (string, error) {
	if err := s.validateConfig(cfg); err != nil {
		return "", err
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = s.defaultBaseURL(cfg.ModelType)
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	if strings.TrimSpace(cfg.APIKey) == "" {
		return "", ErrAIConfigMissingAPIKey
	}

	modelName := cfg.Model
	if modelName == "" {
		modelName = s.defaultModel(cfg.ModelType)
	}

	messages := []LLMMessage{}
	if systemPrompt != "" {
		messages = append(messages, LLMMessage{Role: "system", Content: systemPrompt})
	}
	messages = append(messages, LLMMessage{Role: "user", Content: userPrompt})

	reqBody := LLMRequest{
		Model:       modelName,
		Messages:    messages,
		Temperature: 0.1, // 低温度保证结果稳定
		MaxTokens:   4096,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call LLM API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", s.buildLLMAPIError(resp.StatusCode, resp.Status, respBody)
	}

	var llmResp LLMResponse
	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return "", fmt.Errorf("failed to decode LLM response: %w", err)
	}

	if len(llmResp.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices")
	}

	return llmResp.Choices[0].Message.Content, nil
}

// CallLLMJSON 调用 LLM 并期望返回 JSON（带 JSON 模式提示）
func (s *LLMService) CallLLMJSON(tenantID string, systemPrompt, userPrompt string) (string, error) {
	cfg, err := s.aiConfigService.GetOrInitConfig(tenantID)
	if err != nil {
		return "", fmt.Errorf("failed to get AI config: %w", err)
	}
	if err := s.validateConfig(cfg); err != nil {
		return "", err
	}

	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = s.defaultBaseURL(cfg.ModelType)
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	if strings.TrimSpace(cfg.APIKey) == "" {
		return "", ErrAIConfigMissingAPIKey
	}

	modelName := cfg.Model
	if modelName == "" {
		modelName = s.defaultModel(cfg.ModelType)
	}

	messages := []LLMMessage{}
	if systemPrompt != "" {
		messages = append(messages, LLMMessage{Role: "system", Content: systemPrompt})
	}
	messages = append(messages, LLMMessage{Role: "user", Content: userPrompt})

	// 使用 response_format 提示 JSON 输出
	reqBody := map[string]interface{}{
		"model":       modelName,
		"messages":    messages,
		"temperature": 0.1,
		"max_tokens":  8192,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(context.Background(), "POST", baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call LLM API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", s.buildLLMAPIError(resp.StatusCode, resp.Status, respBody)
	}

	var llmResp LLMResponse
	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return "", fmt.Errorf("failed to decode LLM response: %w", err)
	}

	if len(llmResp.Choices) == 0 {
		return "", fmt.Errorf("LLM returned no choices")
	}

	return llmResp.Choices[0].Message.Content, nil
}

func (s *LLMService) validateConfig(cfg *model.AIServiceConfig) error {
	if cfg == nil {
		return fmt.Errorf("AI 配置不存在，请先完成 AI 配置")
	}
	if strings.TrimSpace(cfg.APIKey) == "" {
		return fmt.Errorf(missingAPIKeyMessage)
	}
	if strings.TrimSpace(cfg.BaseURL) == "" && strings.TrimSpace(s.defaultBaseURL(cfg.ModelType)) == "" {
		return fmt.Errorf("当前 AI 提供商需要配置 Base URL，请先到设置页补全后再重试")
	}
	return nil
}

// defaultBaseURL 根据模型类型返回默认 base URL
func (s *LLMService) defaultBaseURL(modelType string) string {
	switch modelType {
	case "minimax", "minmax":
		return "https://api.minimax.io/v1"
	case "openai":
		return "https://api.openai.com/v1"
	case "azure":
		return "" // Azure 需要用户配置
	default:
		return "https://api.openai.com/v1"
	}
}

// defaultModel 根据模型类型返回默认模型
func (s *LLMService) defaultModel(modelType string) string {
	switch modelType {
	case "minimax", "minmax":
		return "MiniMax-Text-01"
	case "openai":
		return "gpt-4o-mini"
	default:
		return "gpt-4o-mini"
	}
}

// buildLLMAPIError 标准化 LLM API 错误，提供更可操作的提示信息
func (s *LLMService) buildLLMAPIError(statusCode int, status string, respBody []byte) error {
	bodyText := string(respBody)
	if strings.Contains(bodyText, "unsupported_country_region_territory") {
		return fmt.Errorf(
			"LLM API error: status_code=%d status=%s body=%s; 当前地域不支持该模型服务，请在 AI 配置中切换可用的 Base URL（如 OpenAI 兼容网关）或切换到 minimax 等可用提供商",
			statusCode, status, bodyText,
		)
	}
	return fmt.Errorf("LLM API error: status_code=%d status=%s body=%s", statusCode, status, bodyText)
}
