package im

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// DingtalkAdapter 钉钉自定义机器人适配器
type DingtalkAdapter struct{}

func (d *DingtalkAdapter) buildSignedURL(webhookURL, secret string) string {
	ts := time.Now().UnixMilli()
	raw := fmt.Sprintf("%d\n%s", ts, secret)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(raw))
	sign := url.QueryEscape(base64.StdEncoding.EncodeToString(mac.Sum(nil)))
	sep := "&"
	if _, err := url.Parse(webhookURL); err == nil && !containsQuery(webhookURL) {
		sep = "?"
	}
	return fmt.Sprintf("%s%stimestamp=%d&sign=%s", webhookURL, sep, ts, sign)
}

func (d *DingtalkAdapter) Send(webhookURL string, msg Message, secret string) SendResult {
	target := webhookURL
	if secret != "" {
		target = d.buildSignedURL(webhookURL, secret)
	}

	var body map[string]interface{}
	if msg.Markdown {
		body = map[string]interface{}{
			"msgtype": "markdown",
			"markdown": map[string]string{
				"title": msg.Title,
				"text":  msg.Content,
			},
			"at": map[string]interface{}{"isAtAll": msg.AtAll},
		}
	} else {
		body = map[string]interface{}{
			"msgtype": "text",
			"text":    map[string]string{"content": msg.Content},
			"at":      map[string]interface{}{"isAtAll": msg.AtAll},
		}
	}

	return doPost(target, body)
}

func (d *DingtalkAdapter) Test(webhookURL, secret string) SendResult {
	return d.Send(webhookURL, Message{Content: "AI BI 平台连接测试成功"}, secret)
}

// containsQuery 检查 URL 是否已有 query 参数
func containsQuery(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	return u.RawQuery != ""
}

// doPost 通用 POST 请求
func doPost(url string, body interface{}) SendResult {
	data, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return SendResult{Success: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return SendResult{Success: false, Error: "响应解析失败"}
	}

	// 钉钉 errcode=0 表示成功
	if code, ok := result["errcode"]; ok {
		if c, ok := code.(float64); ok && c != 0 {
			msg, _ := result["errmsg"].(string)
			return SendResult{Success: false, Error: msg}
		}
	}
	return SendResult{Success: true}
}
