package service

import (
	"ai-bi-server/internal/im"
	"ai-bi-server/internal/model"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"
)

// DingtalkIncomingMessage 钉钉入站消息
type DingtalkIncomingMessage struct {
	Text             string
	ConversationID   string
	ConversationType string // "1"=单聊 "2"=群聊
	SenderID         string
	SenderNick       string
	SessionWebhook   string // 限时回复 webhook
	Timestamp        string
	Sign             string
}

// DingtalkBotService 钉钉机器人双向对话服务
type DingtalkBotService struct {
	db        *gorm.DB
	imService *IMService
	// nextjsChatURL 前端 chat API 地址（内部调用）
	nextjsChatURL string
}

func NewDingtalkBotService(db *gorm.DB, imService *IMService) *DingtalkBotService {
	chatURL := "http://localhost:3000/api/chat"
	return &DingtalkBotService{
		db:            db,
		imService:     imService,
		nextjsChatURL: chatURL,
	}
}

// HandleIncomingMessage 处理从钉钉收到的消息（在 goroutine 中调用）
func (s *DingtalkBotService) HandleIncomingMessage(msg DingtalkIncomingMessage) {
	log.Printf("[dingtalk-bot] 收到消息: sender=%s text=%q", msg.SenderNick, msg.Text)

	// 1. 查找匹配的已启用钉钉配置（通过 Webhook URL 或类型匹配）
	cfg := s.findDingtalkConfig()
	if cfg == nil {
		log.Println("[dingtalk-bot] 未找到已启用的钉钉配置，无法回复")
		s.replyViaSessonWebhook(msg.SessionWebhook, "抱歉，系统未配置钉钉平台，无法处理您的消息。请联系管理员。")
		return
	}

	// 2. 清理文本（去除 @机器人 前缀等）
	cleanText := cleanAtPrefix(msg.Text)
	if strings.TrimSpace(cleanText) == "" {
		s.replyViaSessonWebhook(msg.SessionWebhook, "请输入您的问题，我会为您分析。")
		return
	}

	// 3. 调用 AI Chat 接口获取回复
	aiReply, err := s.callAIChat(cfg.TenantID, cleanText)
	if err != nil {
		log.Printf("[dingtalk-bot] AI 调用失败: %v", err)
		s.replyViaSessonWebhook(msg.SessionWebhook, "抱歉，AI 服务暂时不可用，请稍后再试。")
		return
	}

	// 4. 清理 AI 回复中的 JSON action blocks（如 dashboard_config、alert_config 等）
	cleanReply := stripActionBlocks(aiReply)
	if strings.TrimSpace(cleanReply) == "" {
		cleanReply = "已收到您的指令并完成处理。"
	}

	// 5. 回复到钉钉（优先使用 sessionWebhook，否则使用配置的 webhook）
	if msg.SessionWebhook != "" {
		s.replyViaSessonWebhook(msg.SessionWebhook, cleanReply)
	} else {
		adapter := im.GetAdapter(model.IMPlatformDingtalk)
		if adapter != nil {
			result := adapter.Send(cfg.WebhookURL, im.Message{
				Content:  cleanReply,
				Markdown: true,
				Keyword:  cfg.Keyword,
			}, cfg.Secret)
			if !result.Success {
				log.Printf("[dingtalk-bot] 回复发送失败: %s", result.Error)
			}
		}
	}

	log.Printf("[dingtalk-bot] 回复完成: sender=%s", msg.SenderNick)
}

// findDingtalkConfig 查找任意一个已启用的钉钉 IM 配置
func (s *DingtalkBotService) findDingtalkConfig() *model.IMConfig {
	var cfg model.IMConfig
	err := s.db.Where("type = ? AND enabled = ?", model.IMPlatformDingtalk, true).
		Order("created_at ASC").
		First(&cfg).Error
	if err != nil {
		return nil
	}
	return &cfg
}

// callAIChat 调用 Next.js 的 /api/chat 接口获取 AI 回复
func (s *DingtalkBotService) callAIChat(tenantID, userMessage string) (string, error) {
	reqBody := map[string]interface{}{
		"messages": []map[string]string{
			{"role": "user", "content": userMessage},
		},
		"tenantId": tenantID,
	}

	bodyBytes, _ := json.Marshal(reqBody)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(s.nextjsChatURL, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("请求 AI Chat 失败: %w", err)
	}
	defer resp.Body.Close()

	// Chat API 返回 SSE 流，需要逐行解析
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取 AI 响应失败: %w", err)
	}

	// 非流式响应（如 demo 模式或错误）
	if resp.Header.Get("Content-Type") == "application/json" {
		var jsonResp struct {
			Content string `json:"content"`
			Error   string `json:"error"`
		}
		if err := json.Unmarshal(respBytes, &jsonResp); err == nil {
			if jsonResp.Error != "" {
				return "", fmt.Errorf("AI 返回错误: %s", jsonResp.Error)
			}
			if jsonResp.Content != "" {
				return jsonResp.Content, nil
			}
		}
	}

	// 解析 SSE 流
	var fullContent strings.Builder
	lines := strings.Split(string(respBytes), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var chunk struct {
			Type    string `json:"type"`
			Content string `json:"content"`
			Error   string `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		switch chunk.Type {
		case "delta":
			fullContent.WriteString(chunk.Content)
		case "error":
			return "", fmt.Errorf("AI 流式错误: %s", chunk.Error)
		case "done":
			// 结束
		}
	}

	result := fullContent.String()
	if result == "" {
		return "", fmt.Errorf("AI 返回空内容")
	}
	return result, nil
}

// replyViaSessonWebhook 通过钉钉限时 sessionWebhook 回复
func (s *DingtalkBotService) replyViaSessonWebhook(webhookURL, content string) {
	if webhookURL == "" {
		return
	}

	body := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"title": "AI 回复",
			"text":  content,
		},
	}

	bodyBytes, _ := json.Marshal(body)
	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		log.Printf("[dingtalk-bot] sessionWebhook 回复失败: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("[dingtalk-bot] sessionWebhook 回复异常 status=%d body=%s", resp.StatusCode, string(respBody))
	}
}

// cleanAtPrefix 去除钉钉 @机器人 产生的前缀文本
func cleanAtPrefix(text string) string {
	// 钉钉群聊中 @ 机器人后，消息格式通常为 "@机器人名 实际内容"
	// 也可能没有 @ 前缀（单聊时）
	text = strings.TrimSpace(text)
	// 去除可能的 @ 前缀
	if idx := strings.Index(text, " "); idx > 0 && strings.HasPrefix(text, "@") {
		text = strings.TrimSpace(text[idx+1:])
	}
	return text
}

// stripActionBlocks 去除 AI 回复中的 ```xxx_config ... ``` 代码块
func stripActionBlocks(content string) string {
	blockTypes := []string{"dashboard_config", "alert_config", "notification_rule", "datasource_config", "report_config"}
	result := content
	for _, bt := range blockTypes {
		for {
			start := strings.Index(result, "```"+bt)
			if start == -1 {
				break
			}
			end := strings.Index(result[start+len("```"+bt):], "```")
			if end == -1 {
				// 未闭合，截断到 start
				result = strings.TrimSpace(result[:start])
				break
			}
			// 移除整个代码块
			blockEnd := start + len("```"+bt) + end + 3
			result = result[:start] + result[blockEnd:]
		}
	}
	return strings.TrimSpace(result)
}
