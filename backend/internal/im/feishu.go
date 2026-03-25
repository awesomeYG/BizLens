package im

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// FeishuAdapter 飞书自定义机器人适配器
type FeishuAdapter struct{}

func (f *FeishuAdapter) buildSign(ts int64, secret string) string {
	raw := fmt.Sprintf("%d\n%s", ts, secret)
	mac := hmac.New(sha256.New, []byte(""))
	mac.Write([]byte(raw))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func (f *FeishuAdapter) Send(webhookURL string, msg Message, secret string) SendResult {
	ts := time.Now().Unix()

	var body map[string]interface{}
	if msg.Markdown {
		body = map[string]interface{}{
			"msg_type": "interactive",
			"card": map[string]interface{}{
				"header": map[string]interface{}{
					"title":    map[string]string{"tag": "plain_text", "content": msg.Title},
					"template": "blue",
				},
				"elements": []map[string]interface{}{
					{"tag": "markdown", "content": msg.Content},
				},
			},
		}
	} else {
		content := msg.Content
		if msg.AtAll {
			content = "<at user_id=\"all\">所有人</at>\n" + content
		}
		body = map[string]interface{}{
			"msg_type": "text",
			"content":  map[string]string{"text": content},
		}
	}

	if secret != "" {
		body["timestamp"] = fmt.Sprintf("%d", ts)
		body["sign"] = f.buildSign(ts, secret)
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

	// 飞书 code=0 或 StatusCode=0 表示成功
	if code, ok := result["code"]; ok {
		if c, ok := code.(float64); ok && c != 0 {
			msg, _ := result["msg"].(string)
			return SendResult{Success: false, Error: msg}
		}
	}
	return SendResult{Success: true}
}

func (f *FeishuAdapter) Test(webhookURL, secret, _ string) SendResult {
	return f.Send(webhookURL, Message{Content: "AI BI 平台连接测试成功"}, secret)
}
