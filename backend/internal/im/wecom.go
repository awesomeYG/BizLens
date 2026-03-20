package im

import (
	"bytes"
	"encoding/json"
	"net/http"
)

// WecomAdapter 企业微信群机器人适配器
type WecomAdapter struct{}

func (w *WecomAdapter) Send(webhookURL string, msg Message, _ string) SendResult {
	var body map[string]interface{}
	if msg.Markdown {
		body = map[string]interface{}{
			"msgtype":  "markdown",
			"markdown": map[string]string{"content": msg.Content},
		}
	} else {
		mentioned := []string{}
		if msg.AtAll {
			mentioned = []string{"@all"}
		}
		body = map[string]interface{}{
			"msgtype": "text",
			"text": map[string]interface{}{
				"content":        msg.Content,
				"mentioned_list": mentioned,
			},
		}
	}

	data, _ := json.Marshal(body)
	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(data))
	if err != nil {
		return SendResult{Success: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return SendResult{Success: false, Error: "响应解析失败"}
	}

	if code, ok := result["errcode"]; ok {
		if c, ok := code.(float64); ok && c != 0 {
			msg, _ := result["errmsg"].(string)
			return SendResult{Success: false, Error: msg}
		}
	}
	return SendResult{Success: true}
}

func (w *WecomAdapter) Test(webhookURL, _ string) SendResult {
	return w.Send(webhookURL, Message{Content: "AI BI 平台连接测试成功"}, "")
}
