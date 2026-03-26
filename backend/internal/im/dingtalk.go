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
	"strings"
	"time"
)

// DingtalkAdapter 钉钉自定义机器人适配器
type DingtalkAdapter struct{}

func dingtalkEnsureKeyword(content, keyword string) string {
	kw := strings.TrimSpace(keyword)
	if kw == "" {
		return content
	}
	if strings.Contains(content, kw) {
		return content
	}
	return kw + "\n" + content
}

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

	title := msg.Title
	content := dingtalkEnsureKeyword(msg.Content, msg.Keyword)
	if msg.Markdown && strings.TrimSpace(title) != "" {
		title = dingtalkEnsureKeyword(title, msg.Keyword)
	}

	// 对长消息进行分割，每段不超过 maxIMMessageLen 字符
	chunks := splitMessage(content)

	// 如果分割后只有一段，直接发送
	if len(chunks) == 1 {
		return d.sendOneMessage(target, chunks[0], msg.Markdown, title, msg.AtAll)
	}

	// 多段消息：逐条发送，保留第一段的 at 配置
	var lastResult SendResult
	for i, chunk := range chunks {
		chunkTitle := title
		// 非首条消息，标题加上序号以便区分
		if i > 0 && chunkTitle != "" {
			chunkTitle = fmt.Sprintf("%s (%d/%d)", title, i+1, len(chunks))
		}
		isAtAll := false // 非首条消息不触发 @所有人
		result := d.sendOneMessage(target, chunk, msg.Markdown, chunkTitle, isAtAll)
		lastResult = result
		// 如果某条失败，立即返回
		if !result.Success {
			return result
		}
		// 避免发送过快，稍微间隔一下
		if i < len(chunks)-1 {
			time.Sleep(200 * time.Millisecond)
		}
	}
	return lastResult
}

// sendOneMessage 发送单条消息
func (d *DingtalkAdapter) sendOneMessage(target, content string, isMarkdown bool, title string, atAll bool) SendResult {
	var body map[string]interface{}
	if isMarkdown {
		body = map[string]interface{}{
			"msgtype": "markdown",
			"markdown": map[string]string{
				"title": title,
				"text":  content,
			},
			"at": map[string]interface{}{"isAtAll": atAll},
		}
	} else {
		body = map[string]interface{}{
			"msgtype": "text",
			"text":    map[string]string{"content": content},
			"at":      map[string]interface{}{"isAtAll": atAll},
		}
	}
	return doPost(target, body)
}

func (d *DingtalkAdapter) Test(webhookURL, secret, keyword string) SendResult {
	return d.Send(webhookURL, Message{Content: "AI BI 平台连接测试成功", Keyword: keyword}, secret)
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

// maxIMMessageLen is the maximum length for a single IM text/markdown message.
// 钉钉 text 类型 content 最大 4000 字符，markdown text 最大 4096 字符。
// 为保持一致性和兼容性，统一使用 4000 作为分割阈值。
const maxIMMessageLen = 4000

// splitMessage splits a long message into chunks not exceeding maxIMMessageLen characters.
// It tries to split at line breaks to keep message chunks readable.
func splitMessage(msg string) []string {
	if len(msg) <= maxIMMessageLen {
		return []string{msg}
	}
	var chunks []string
	lines := strings.Split(msg, "\n")
	current := &strings.Builder{}
	currentLen := 0

	for _, line := range lines {
		lineLen := len(line)
		// If single line exceeds max, split it by characters
		if lineLen > maxIMMessageLen {
			// Flush current buffer first
			if current.Len() > 0 {
				chunks = append(chunks, strings.TrimSpace(current.String()))
				current.Reset()
				currentLen = 0
			}
			// Split the long line into character-level chunks
			for i := 0; i < lineLen; i += maxIMMessageLen {
				end := i + maxIMMessageLen
				if end > lineLen {
					end = lineLen
				}
				chunks = append(chunks, line[i:end])
			}
			continue
		}

		// Check if adding this line would exceed the limit
		needLen := currentLen + lineLen
		if currentLen > 0 {
			needLen++ // +1 for newline
		}
		if needLen > maxIMMessageLen {
			// Current chunk is full, start a new one
			if current.Len() > 0 {
				chunks = append(chunks, strings.TrimSpace(current.String()))
				current.Reset()
				currentLen = 0
			}
		}

		if current.Len() > 0 {
			current.WriteString("\n")
			currentLen++
		}
		current.WriteString(line)
		currentLen += lineLen
	}

	if current.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(current.String()))
	}

	// Edge case: empty input
	if len(chunks) == 0 {
		return []string{""}
	}
	return chunks
}
