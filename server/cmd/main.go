package main

import (
	"ai-bi-server/internal/config"
	"ai-bi-server/internal/handler"
	"ai-bi-server/internal/middleware"
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"fmt"
	"log"
	"net/http"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	// 连接数据库
	var db *gorm.DB
	var err error

	if cfg.UseSQLite {
		log.Println("使用 SQLite 数据库...")
		db, err = gorm.Open(sqlite.Open(cfg.DSN()), &gorm.Config{})
	} else {
		log.Println("使用 PostgreSQL 数据库...")
		db, err = gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{})
	}

	if err != nil {
		log.Fatalf("数据库连接失败：%v", err)
	}
	log.Println("数据库连接成功")

	// 自动迁移
	if err := model.AutoMigrate(db); err != nil {
		log.Fatalf("数据库迁移失败：%v", err)
	}
	log.Println("数据库迁移完成")

	// 初始化服务和 handler
	imService := service.NewIMService(db)
	imHandler := handler.NewIMHandler(imService)

	// 路由
	mux := http.NewServeMux()

	// 健康检查
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// IM 配置路由：/api/tenants/{tenantId}/im-configs[/{configId}[/test]]
	mux.HandleFunc("/api/tenants/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
		parts := strings.Split(strings.Trim(path, "/"), "/")

		// /api/tenants/{tenantId}/im-configs
		if len(parts) >= 2 && parts[1] == "im-configs" {
			switch {
			// POST /api/tenants/{id}/im-configs/{configId}/test
			case len(parts) == 4 && parts[3] == "test" && r.Method == http.MethodPost:
				imHandler.TestIMConfig(w, r)
				return

			// GET/PUT/DELETE /api/tenants/{id}/im-configs/{configId}
			case len(parts) == 3:
				switch r.Method {
				case http.MethodGet:
					imHandler.GetIMConfig(w, r)
				case http.MethodPut:
					imHandler.UpdateIMConfig(w, r)
				case http.MethodDelete:
					imHandler.DeleteIMConfig(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			// GET/POST /api/tenants/{id}/im-configs
			case len(parts) == 2:
				switch r.Method {
				case http.MethodGet:
					imHandler.ListIMConfigs(w, r)
				case http.MethodPost:
					imHandler.CreateIMConfig(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}

		// /api/tenants/{tenantId}/notifications[/send]
		if len(parts) >= 2 && parts[1] == "notifications" {
			switch {
			// POST /api/tenants/{id}/notifications/send
			case len(parts) == 3 && parts[2] == "send" && r.Method == http.MethodPost:
				imHandler.SendNotification(w, r)
				return

			// GET /api/tenants/{id}/notifications
			case len(parts) == 2 && r.Method == http.MethodGet:
				imHandler.ListNotifications(w, r)
				return
			}
		}

		http.NotFound(w, r)
	})

	// 启动服务
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("服务启动在 %s", addr)
	if err := http.ListenAndServe(addr, middleware.CORS(mux)); err != nil {
		log.Fatalf("服务启动失败：%v", err)
	}
}
