package service

import (
	"ai-bi-server/internal/model"
	"context"
	"encoding/json"
	"log"
	"strings"

	"github.com/open-dingtalk/dingtalk-stream-sdk-go/chatbot"
	"github.com/open-dingtalk/dingtalk-stream-sdk-go/client"
	"gorm.io/gorm"
)

// DingtalkStreamService 钉钉 Stream 模式客户端服务
type DingtalkStreamService struct {
	db            *gorm.DB
	imService     *IMService
	botService    *DingtalkBotService
	streamClients map[string]*client.StreamClient // key: IMConfig.ID
}

func NewDingtalkStreamService(db *gorm.DB, imService *IMService, botService *DingtalkBotService) *DingtalkStreamService {
	return &DingtalkStreamService{
		db:            db,
		imService:     imService,
		botService:    botService,
		streamClients: make(map[string]*client.StreamClient),
	}
}

// StartAll 启动所有已启用的钉钉 Stream 连接
func (s *DingtalkStreamService) StartAll(ctx context.Context) error {
	var configs []model.IMConfig
	err := s.db.Where("type = ? AND enabled = ?", model.IMPlatformDingtalk, true).Find(&configs).Error
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := s.StartOne(ctx, &cfg); err != nil {
			log.Printf("[dingtalk-stream] 启动失败 config_id=%s error=%v", cfg.ID, err)
		}
	}

	return nil
}

// StartOne 启动单个钉钉 Stream 连接
func (s *DingtalkStreamService) StartOne(ctx context.Context, cfg *model.IMConfig) error {
	if cfg.Type != model.IMPlatformDingtalk || !cfg.Enabled {
		return nil
	}

	// 解析 AppKey 和 AppSecret（存在 Secret 字段，格式：appKey:appSecret）
	parts := strings.SplitN(cfg.Secret, ":", 2)
	if len(parts) != 2 {
		log.Printf("[dingtalk-stream] Secret 格式错误，应为 appKey:appSecret，config_id=%s", cfg.ID)
		return nil
	}
	appKey, appSecret := parts[0], parts[1]

	cli := client.NewStreamClient(
		client.WithAppCredential(client.NewAppCredentialConfig(appKey, appSecret)),
	)

	// 注册机器人消息处理器
	cli.RegisterChatBotCallbackRouter(func(ctx context.Context, data *chatbot.BotCallbackDataModel) ([]byte, error) {
		return s.handleBotMessage(cfg, data)
	})

	// 启动连接
	go func() {
		if err := cli.Start(context.Background()); err != nil {
			log.Printf("[dingtalk-stream] 连接失败 config_id=%s error=%v", cfg.ID, err)
		}
	}()

	s.streamClients[cfg.ID] = cli
	log.Printf("[dingtalk-stream] 已启动 config_id=%s tenant_id=%s", cfg.ID, cfg.TenantID)

	return nil
}

// handleBotMessage 处理机器人消息
func (s *DingtalkStreamService) handleBotMessage(cfg *model.IMConfig, data *chatbot.BotCallbackDataModel) ([]byte, error) {
	log.Printf("[dingtalk-stream] 收到消息: sender=%s text=%s", data.SenderNick, data.Text.Content)

	userText := strings.TrimSpace(data.Text.Content)
	if userText == "" {
		return s.replyText("请输入您的问题"), nil
	}

	// 调用 AI Chat
	aiReply, err := s.botService.callAIChat(cfg.TenantID, userText)
	if err != nil {
		log.Printf("[dingtalk-stream] AI 调用失败: %v", err)
		return s.replyText("抱歉，AI 服务暂时不可用"), nil
	}

	// 清理 action blocks
	cleanReply := stripActionBlocks(aiReply)
	if strings.TrimSpace(cleanReply) == "" {
		cleanReply = "已收到您的指令并完成处理。"
	}

	return s.replyMarkdown("AI 回复", cleanReply), nil
}

// replyText 返回文本消息
func (s *DingtalkStreamService) replyText(content string) []byte {
	reply := map[string]interface{}{
		"msgtype": "text",
		"text": map[string]string{
			"content": content,
		},
	}
	data, _ := json.Marshal(reply)
	return data
}

// replyMarkdown 返回 Markdown 消息
func (s *DingtalkStreamService) replyMarkdown(title, content string) []byte {
	reply := map[string]interface{}{
		"msgtype": "markdown",
		"markdown": map[string]string{
			"title": title,
			"text":  content,
		},
	}
	data, _ := json.Marshal(reply)
	return data
}

// StopAll 停止所有 Stream 连接
func (s *DingtalkStreamService) StopAll() {
	for id, cli := range s.streamClients {
		cli.Close()
		log.Printf("[dingtalk-stream] 已停止 config_id=%s", id)
	}
	s.streamClients = make(map[string]*client.StreamClient)
}
