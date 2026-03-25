package handler

import (
	"ai-bi-server/internal/service"
	"encoding/json"
	"io"
	"log"
	"net/http"
)

// DingtalkCallbackHandler 钉钉机器人入站回调
type DingtalkCallbackHandler struct {
	botService *service.DingtalkBotService
}

func NewDingtalkCallbackHandler(botService *service.DingtalkBotService) *DingtalkCallbackHandler {
	return &DingtalkCallbackHandler{botService: botService}
}

// dingtalkCallbackBody 钉钉自定义机器人「outgoing」回调请求体（简化版）
// 文档: https://open.dingtalk.com/document/orgapp/receive-message
type dingtalkCallbackBody struct {
	MsgType                   string                    `json:"msgtype"`
	Text                      *struct{ Content string } `json:"text,omitempty"`
	ConversationID            string                    `json:"conversationId"`
	ConversationType          string                    `json:"conversationType"` // "1"=单聊 "2"=群聊
	SenderID                  string                    `json:"senderId"`
	SenderNick                string                    `json:"senderNick"`
	SessionWebhook            string                    `json:"sessionWebhook"` // 限时 webhook（回复用）
	SessionWebhookExpiredTime int64                     `json:"sessionWebhookExpiredTime"`
	// 可选：机器人 chatbotUserId、createAt 等
}

// HandleCallback POST /api/webhook/dingtalk
// 钉钉自定义机器人 outgoing 模式回调入口
func (h *DingtalkCallbackHandler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 读取请求体
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[dingtalk-callback] 读取请求体失败: %v", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "读取请求体失败"})
		return
	}
	defer r.Body.Close()

	// 获取签名相关 header（钉钉自定义机器人 outgoing 会传 timestamp + sign）
	timestamp := r.Header.Get("timestamp")
	sign := r.Header.Get("sign")

	// 解析请求体
	var cb dingtalkCallbackBody
	if err := json.Unmarshal(bodyBytes, &cb); err != nil {
		log.Printf("[dingtalk-callback] 解析请求体失败: %v", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "请求体解析失败"})
		return
	}

	// 提取用户发送的文本
	userText := ""
	if cb.Text != nil {
		userText = cb.Text.Content
	}
	if userText == "" {
		// 非文本消息，忽略
		writeJSON(w, http.StatusOK, map[string]string{"status": "ignored"})
		return
	}

	// 异步处理消息（钉钉要求 webhook 在几秒内返回）
	go func() {
		h.botService.HandleIncomingMessage(service.DingtalkIncomingMessage{
			Text:             userText,
			ConversationID:   cb.ConversationID,
			ConversationType: cb.ConversationType,
			SenderID:         cb.SenderID,
			SenderNick:       cb.SenderNick,
			SessionWebhook:   cb.SessionWebhook,
			Timestamp:        timestamp,
			Sign:             sign,
		})
	}()

	// 立即返回空 JSON（钉钉只要求 HTTP 200）
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
