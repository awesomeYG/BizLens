package im

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// DiscordAdapter Discord Webhook 适配器
type DiscordAdapter struct{}

// DiscordEmbed Discord 嵌入消息
type DiscordEmbed struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Color       int    `json:"color,omitempty"`
	Footer      struct {
		Text string `json:"text"`
	} `json:"footer,omitempty"`
}

// DiscordWebhookBody Discord webhook 请求体
type DiscordWebhookBody struct {
	Content   string         `json:"content"`
	Username  string         `json:"username,omitempty"`
	AvatarURL string         `json:"avatar_url,omitempty"`
	Embeds    []DiscordEmbed `json:"embeds,omitempty"`
}

func (d *DiscordAdapter) Send(webhookURL string, msg Message, secret string) SendResult {
	// Discord Webhook 不需要签名
	body := DiscordWebhookBody{
		Content:  msg.Content,
		Username: "AI BI Platform",
	}

	// 如果有标题，使用 embed 样式
	if msg.Title != "" {
		var embed DiscordEmbed
		embed.Title = msg.Title
		embed.Description = msg.Content
		embed.Color = 5814783 // 蓝紫色 #5865F2
		embed.Footer.Text = "AI BI Platform"
		body.Embeds = []DiscordEmbed{embed}
		body.Content = "" // 有 embed 时不需要 content
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

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return SendResult{Success: false, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}

	return SendResult{Success: true}
}

func (d *DiscordAdapter) Test(webhookURL, secret string) SendResult {
	return d.Send(webhookURL, Message{
		Title:    "🤖 AI BI 平台连接测试",
		Content:  "如果您收到这条消息，说明 Discord Webhook 配置正确！",
		Markdown: true,
	}, secret)
}
