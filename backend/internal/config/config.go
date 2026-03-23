package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port       string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	UseSQLite  bool
	// 认证相关
	JWTSecret          string
	Env                string // development / production
	AccessTokenExpire  int    // Access Token 过期时间（分钟）
	RefreshTokenExpire int    // Refresh Token 过期时间（天）
}

func Load() *Config {
	return &Config{
		Port:       getEnv("SERVER_PORT", "3001"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "ai_bi"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		UseSQLite:  getEnv("USE_SQLITE", "true") == "true",
		// 认证相关
		JWTSecret:          getEnv("JWT_SECRET", "change-this-secret-in-production"),
		Env:                getEnv("ENV", "development"),
		AccessTokenExpire:  getEnvInt("ACCESS_TOKEN_EXPIRE", 30), // 默认 30 分钟
		RefreshTokenExpire: getEnvInt("REFRESH_TOKEN_EXPIRE", 7), // 默认 7 天
	}
}

func (c *Config) DSN() string {
	if c.UseSQLite {
		return "/workspace/server/ai_bi.db"
	}
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
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
