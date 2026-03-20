package im

import "ai-bi-server/internal/model"

// SendResult 发送结果
type SendResult struct {
	Success bool
	Error   string
}

// Message 发送消息体
type Message struct {
	Title    string
	Content  string
	Markdown bool
	AtAll    bool
}

// Adapter IM 平台适配器接口
type Adapter interface {
	Send(webhookURL string, msg Message, secret string) SendResult
	Test(webhookURL string, secret string) SendResult
}

// GetAdapter 根据平台类型获取适配器
func GetAdapter(t model.IMPlatformType) Adapter {
	switch t {
	case model.IMPlatformDingtalk:
		return &DingtalkAdapter{}
	case model.IMPlatformFeishu:
		return &FeishuAdapter{}
	case model.IMPlatformWecom:
		return &WecomAdapter{}
	case model.IMPlatformSlack:
		return &SlackAdapter{}
	case model.IMPlatformTelegram:
		return &TelegramAdapter{}
	case model.IMPlatformDiscord:
		return &DiscordAdapter{}
	default:
		return nil
	}
}
