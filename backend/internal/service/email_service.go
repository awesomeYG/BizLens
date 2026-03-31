package service

import (
	"ai-bi-server/internal/config"
	"crypto/tls"
	"fmt"
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

	body := strings.Join([]string{
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		fmt.Sprintf("%s，您好：", plainName),
		"",
		"我们收到了您的 BizLens 密码重置请求。",
		"请在链接有效期内打开下面的地址完成新密码设置：",
		resetURL,
		"",
		fmt.Sprintf("该链接将在 %s 失效。", expiresAt.Format("2006-01-02 15:04 MST")),
		"如果这不是您的操作，请忽略此邮件，您的账号不会被修改。",
	}, "\r\n")

	addr := fmt.Sprintf("%s:%s", s.cfg.SMTPHost, s.cfg.SMTPPort)
	if s.cfg.SMTPPort == "465" {
		return s.sendWithTLS(addr, toEmail, []byte(body))
	}

	var auth smtp.Auth
	if s.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	}

	return smtp.SendMail(addr, auth, envelopeFrom, []string{toEmail}, []byte(body))
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
