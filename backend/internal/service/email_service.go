package service

import (
	"ai-bi-server/internal/config"
	"crypto/tls"
	"fmt"
	"html"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

func (s *EmailService) IsConfigured() bool {
	return s != nil && s.cfg.SMTPHost != "" && s.cfg.SMTPFrom != ""
}

func (s *EmailService) SendPasswordResetEmail(toEmail, toName, resetURL string, expiresAt time.Time) error {
	if !s.IsConfigured() {
		return fmt.Errorf("邮件服务未配置")
	}

	subject := "BizLens 密码重置"
	fromHeader, envelopeFrom := normalizeEmailFrom(s.cfg.SMTPFrom)
	plainName := strings.TrimSpace(toName)
	if plainName == "" {
		plainName = toEmail
	}
	expiresText := expiresAt.Format("2006-01-02 15:04 MST")
	textBody := strings.Join([]string{
		fmt.Sprintf("%s，您好：", plainName),
		"",
		"我们收到了您的 BizLens 密码重置请求。",
		"请在链接有效期内打开下面的地址完成新密码设置：",
		resetURL,
		"",
		fmt.Sprintf("该链接将在 %s 失效。", expiresText),
		"如果这不是您的操作，请忽略此邮件，您的账号不会被修改。",
	}, "\r\n")
	htmlBody := buildPasswordResetHTML(plainName, resetURL, expiresText)
	message := buildMultipartEmail(fromHeader, toEmail, subject, textBody, htmlBody)

	addr := fmt.Sprintf("%s:%s", s.cfg.SMTPHost, s.cfg.SMTPPort)
	if s.cfg.SMTPPort == "465" {
		return s.sendWithTLS(addr, toEmail, []byte(message))
	}

	client, err := smtp.Dial(addr)
	if err == nil {
		defer client.Quit()
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: s.cfg.SMTPHost}); err != nil {
				return err
			}
		}
		if s.cfg.SMTPUser != "" {
			auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPassword, s.cfg.SMTPHost)
			if err := client.Auth(auth); err != nil {
				return err
			}
		}
		if err := client.Mail(envelopeFrom); err != nil {
			return err
		}
		if err := client.Rcpt(toEmail); err != nil {
			return err
		}
		wc, err := client.Data()
		if err != nil {
			return err
		}
		if _, err := wc.Write([]byte(message)); err != nil {
			_ = wc.Close()
			return err
		}
		return wc.Close()
	}

	var auth smtp.Auth
	if s.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	}

	return smtp.SendMail(addr, auth, envelopeFrom, []string{toEmail}, []byte(message))
}

func (s *EmailService) sendWithTLS(addr, toEmail string, body []byte) error {
	_, envelopeFrom := normalizeEmailFrom(s.cfg.SMTPFrom)
	conn, err := tls.Dial("tcp", addr, &tls.Config{
		ServerName: s.cfg.SMTPHost,
	})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.cfg.SMTPHost)
	if err != nil {
		return err
	}
	defer client.Quit()

	if s.cfg.SMTPUser != "" {
		auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPassword, s.cfg.SMTPHost)
		if err := client.Auth(auth); err != nil {
			return err
		}
	}

	if err := client.Mail(envelopeFrom); err != nil {
		return err
	}
	if err := client.Rcpt(toEmail); err != nil {
		return err
	}

	wc, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := wc.Write(body); err != nil {
		_ = wc.Close()
		return err
	}
	return wc.Close()
}

func normalizeEmailFrom(raw string) (string, string) {
	addr, err := mail.ParseAddress(raw)
	if err != nil {
		return raw, raw
	}
	return addr.String(), addr.Address
}

func buildMultipartEmail(fromHeader, toEmail, subject, textBody, htmlBody string) string {
	boundary := fmt.Sprintf("bizlens-boundary-%d", time.Now().UnixNano())
	return strings.Join([]string{
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		fmt.Sprintf("Content-Type: multipart/alternative; boundary=%q", boundary),
		"",
		fmt.Sprintf("--%s", boundary),
		"Content-Type: text/plain; charset=UTF-8",
		"",
		textBody,
		"",
		fmt.Sprintf("--%s", boundary),
		"Content-Type: text/html; charset=UTF-8",
		"",
		htmlBody,
		"",
		fmt.Sprintf("--%s--", boundary),
	}, "\r\n")
}

func buildPasswordResetHTML(name, resetURL, expiresText string) string {
	escapedName := html.EscapeString(name)
	escapedURL := html.EscapeString(resetURL)
	escapedExpires := html.EscapeString(expiresText)
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(135deg,#0f766e,#0891b2);border-radius:24px;padding:32px;color:#fff;">
        <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.78;">BizLens</div>
        <h1 style="margin:14px 0 12px;font-size:32px;line-height:1.2;">重置你的登录密码</h1>
        <p style="margin:0;font-size:16px;line-height:1.7;opacity:.9;">收到这封邮件，说明有人为你的账号发起了密码重置请求。</p>
      </div>
      <div style="background:#ffffff;border:1px solid #dbe4f0;border-radius:24px;margin-top:-24px;padding:32px;box-shadow:0 16px 40px rgba(15,23,42,.08);">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">%s，您好：</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">请点击下面的按钮完成密码重置。为了保证安全，该链接仅在短时间内有效。</p>
        <p style="margin:28px 0;">
          <a href="%s" style="display:inline-block;padding:14px 24px;border-radius:14px;background:linear-gradient(135deg,#0f766e,#06b6d4);color:#fff;text-decoration:none;font-size:15px;font-weight:600;">立即重置密码</a>
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">如果按钮无法点击，请复制下面的地址到浏览器打开：</p>
        <p style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border-radius:14px;word-break:break-all;font-size:13px;line-height:1.7;color:#0f172a;">%s</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#334155;">该链接将在 %s 失效。如果这不是你的操作，请忽略此邮件，你的账号不会被修改。</p>
      </div>
    </div>
  </body>
</html>`, escapedName, escapedURL, escapedURL, escapedExpires)
}
