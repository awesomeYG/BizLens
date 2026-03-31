package config

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	DBSSLMode   string
	UseSQLite   bool
	// 认证相关
	JWTSecret          string
	Env                string // development / production
	AccessTokenExpire  int    // Access Token 过期时间（分钟）
	RefreshTokenExpire int    // Refresh Token 过期时间（天）
	AppBaseURL         string
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPassword       string
	SMTPFrom           string
	// 授权码相关
	LicenseKey     string // 必填，授权码
	LicenseSeats   int    // 可选，最大用户数上限（0 表示不限制）
	LicenseExpires string // 可选，到期日期 YYYY-MM-DD
}

func Load() *Config {
	loadEnvFiles()

	// 加载授权码（必填）
	licenseKey := os.Getenv("LICENSE_KEY")
	if licenseKey == "" {
		log.Fatal("错误：未配置环境变量 LICENSE_KEY，无法启动系统")
	}
	if !isValidLicenseKeyFormat(licenseKey) {
		log.Fatal("错误：LICENSE_KEY 格式无效，应为 XXXX-XXXX-XXXX-XXXX")
	}
	log.Printf("授权码已配置：%s", maskLicenseKey(licenseKey))

	licenseSeats := getEnvInt("LICENSE_SEATS", 0)
	licenseExpires := os.Getenv("LICENSE_EXPIRES")

	return &Config{
		Port:        getEnv("SERVER_PORT", "3001"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "5432"),
		DBUser:      getEnv("DB_USER", "postgres"),
		DBPassword:  getEnv("DB_PASSWORD", "postgres"),
		DBName:      getEnv("DB_NAME", "ai_bi"),
		DBSSLMode:   getEnv("DB_SSLMODE", "disable"),
		UseSQLite:   getEnv("USE_SQLITE", "true") == "true",
		// 认证相关
		JWTSecret:          getEnv("JWT_SECRET", "change-this-secret-in-production"),
		Env:                getEnv("ENV", "development"),
		AccessTokenExpire:  getEnvInt("ACCESS_TOKEN_EXPIRE", 30), // 默认 30 分钟
		RefreshTokenExpire: getEnvInt("REFRESH_TOKEN_EXPIRE", 7), // 默认 7 天
		AppBaseURL:         getEnv("APP_BASE_URL", "http://localhost:3000"),
		SMTPHost:           getEnv("SMTP_HOST", ""),
		SMTPPort:           getEnv("SMTP_PORT", "587"),
		SMTPUser:           getEnv("SMTP_USER", ""),
		SMTPPassword:       getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:           getEnv("SMTP_FROM", ""),
		// 授权码相关
		LicenseKey:     licenseKey,
		LicenseSeats:   licenseSeats,
		LicenseExpires: licenseExpires,
	}
}

// isValidLicenseKeyFormat 校验授权码格式（XXXX-XXXX-XXXX-XXXX）
func isValidLicenseKeyFormat(key string) bool {
	if len(key) != 19 { // 16 chars + 3 hyphens
		return false
	}
	parts := strings.Split(key, "-")
	if len(parts) != 4 {
		return false
	}
	for _, part := range parts {
		if len(part) != 4 {
			return false
		}
		for _, c := range part {
			if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
				return false
			}
		}
	}
	return true
}

// maskLicenseKey 脱敏授权码，仅显示前4位和后4位
func maskLicenseKey(key string) string {
	if len(key) < 9 {
		return "****"
	}
	return key[:4] + "-****-****-" + key[len(key)-4:]
}

func (c *Config) DSN() string {
	if c.UseSQLite {
		sqlitePath := getEnv("SQLITE_DB_PATH", "/tmp/ai_bi.db")
		if dir := filepath.Dir(sqlitePath); dir != "." {
			// Ensure custom SQLite path is usable in local/dev envs.
			if err := os.MkdirAll(dir, 0o755); err != nil {
				sqlitePath = "/tmp/ai_bi.db"
			}
		}
		return fmt.Sprintf("file:%s?cache=shared", sqlitePath)
	}
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func loadEnvFiles() {
	locked := make(map[string]struct{})
	for _, entry := range os.Environ() {
		key, _, found := strings.Cut(entry, "=")
		if found && key != "" {
			locked[key] = struct{}{}
		}
	}

	paths := []string{
		filepath.Join("..", ".env"),
		".env",
		filepath.Join("..", ".env.local"),
		".env.local",
	}

	for _, path := range paths {
		loadEnvFile(path, locked)
	}
}

func loadEnvFile(path string, locked map[string]struct{}) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		line = strings.TrimPrefix(line, "export ")
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key == "" || value == "" {
			continue
		}
		if _, exists := locked[key]; exists {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getEnvInt 获取整数环境变量
func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		var val int
		if _, err := fmt.Sscanf(v, "%d", &val); err == nil {
			return val
		}
	}
	return fallback
}
