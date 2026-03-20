package im

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// TelegramAdapter Telegram Bot 适配器
type TelegramAdapter struct{}

// TelegramMessage Telegram 消息体
type TelegramMessage struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode,omitempty"`
}

func (t *TelegramAdapter) Send(webhookURL string, msg Message, secret string) SendResult {
	// Telegram 使用 Bot API，webhookURL 应该是 https://api.telegram.org/bot<TOKEN>/sendMessage
	// 或者直接使用自定义的 webhook 格式

	// 解析 webhookURL 获取 token 和 chat_id
	// 格式：https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=<CHAT_ID>

	var token, chatID string

	// 简单解析 webhook URL
	// 期望格式：https://api.telegram.org/bot{token}/sendMessage
	if len(webhookURL) > 44 && webhookURL[:44] == "https://api.telegram.org/bot" {
		// 提取 token
		parts := bytes.Split([]byte(webhookURL), []byte("/"))
		if len(parts) >= 5 {
			token = string(parts[4])
			chatID = secret // 使用 secret 字段存储 chat_id
		}
	}

	if token == "" {
		// 如果无法解析，尝试直接使用 webhookURL 作为完整的 API 端点
		// 此时 secret 应该包含 chat_id
		chatID = secret
	}

	text := msg.Content
	if msg.Title != "" {
		text = fmt.Sprintf("*%s*\n%s", msg.Title, msg.Content)
	}

	body := TelegramMessage{
		ChatID: chatID,
		Text:   text,
	}

	if msg.Markdown {
		body.ParseMode = "Markdown"
	}

	jsonData, err := json.Marshal(body)
	if err != nil {
		return SendResult{Success: false, Error: fmt.Sprintf("序列化失败：%v", err)}
	}

	// 构建 API URL
	apiURL := webhookURL
	if chatID != "" && token != "" {
		apiURL = fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return SendResult{Success: false, Error: fmt.Sprintf("请求失败：%v", err)}
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	if !result.OK {
		return SendResult{Success: false, Error: result.Description}
	}

	return SendResult{Success: true}
}

func (t *TelegramAdapter) Test(webhookURL, secret string) SendResult {
	return t.Send(webhookURL, Message{
		Title:    "🤖 AI BI 平台",
		Content:  "如果您收到这条消息，说明 Telegram Bot 配置正确！",
		Markdown: true,
	}, secret)
}
