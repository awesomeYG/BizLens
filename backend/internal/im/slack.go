package im

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// SlackAdapter Slack 机器人适配器
type SlackAdapter struct{}

// SlackWebhookBody Slack webhook 请求体
type SlackWebhookBody struct {
	Text        string `json:"text"`
	Username    string `json:"username,omitempty"`
	IconEmoji   string `json:"icon_emoji,omitempty"`
	Mrkdwn      bool   `json:"mrkdwn,omitempty"`
	Channel     string `json:"channel,omitempty"`
	UnfurlLinks bool   `json:"unfurl_links,omitempty"`
}

func (s *SlackAdapter) Send(webhookURL string, msg Message, secret string) SendResult {
	// Slack 不需要签名
	body := SlackWebhookBody{
		Text:        msg.Content,
		Username:    "AI BI Platform",
		Mrkdwn:      msg.Markdown,
		UnfurlLinks: true,
	}

	if msg.Title != "" {
		body.Text = fmt.Sprintf("*%s*\n%s", msg.Title, msg.Content)
	}

	jsonData, err := json.Marshal(body)
	if err != nil {
		return SendResult{Success: false, Error: fmt.Sprintf("序列化失败：%v", err)}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(webhookURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return SendResult{Success: false, Error: fmt.Sprintf("请求失败：%v", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return SendResult{Success: false, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}

	return SendResult{Success: true}
}

func (s *SlackAdapter) Test(webhookURL, secret, _ string) SendResult {
	return s.Send(webhookURL, Message{
		Title:    "🤖 AI BI 平台连接测试",
		Content:  "如果您收到这条消息，说明 Webhook 配置正确！",
		Markdown: true,
	}, secret)
}
