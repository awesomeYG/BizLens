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

	"github.com/google/uuid"
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

	// SQLite 需要手动生成 UUID (通过 BeforeCreate hook)
	if cfg.UseSQLite {
		type BaseEntity struct {
			ID string `gorm:"type:varchar(50);primaryKey"`
		}
		db.Callback().Create().Before("gorm:before_create").Register("uuid_gen", func(tx *gorm.DB) {
			if id := tx.Statement.Context.Value("generated_id"); id == nil {
				tx.Statement.SetColumn("ID", uuid.New().String())
			}
		})
	}

	// 初始化服务和 handler
	imService := service.NewIMService(db)
	imHandler := handler.NewIMHandler(imService)
	alertService := service.NewAlertService(db, imService)
	alertHandler := handler.NewAlertHandler(alertService)
	dataSourceService := service.NewDataSourceService(db)
	dataSourceHandler := handler.NewDataSourceHandler(dataSourceService)
	schemaHandler := handler.NewSchemaHandler(dataSourceService)

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

		// /api/tenants/{tenantId}/alerts[/{eventId}[/trigger]] | /alerts/logs
		if len(parts) >= 2 && parts[1] == "alerts" {
			switch {
			// GET /api/tenants/{id}/alerts/logs
			case len(parts) == 3 && parts[2] == "logs" && r.Method == http.MethodGet:
				alertHandler.ListTriggerLogs(w, r)
				return

			// POST /api/tenants/{id}/alerts/{eventId}/trigger
			case len(parts) == 4 && parts[3] == "trigger" && r.Method == http.MethodPost:
				alertHandler.TriggerAlertEvent(w, r)
				return

			// GET/PUT/DELETE /api/tenants/{id}/alerts/{eventId}
			case len(parts) == 3 && parts[2] != "logs":
				switch r.Method {
				case http.MethodGet:
					alertHandler.GetAlertEvent(w, r)
				case http.MethodPut:
					alertHandler.UpdateAlertEvent(w, r)
				case http.MethodDelete:
					alertHandler.DeleteAlertEvent(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			// GET/POST /api/tenants/{id}/alerts
			case len(parts) == 2:
				switch r.Method {
				case http.MethodGet:
					alertHandler.ListAlertEvents(w, r)
				case http.MethodPost:
					alertHandler.CreateAlertEvent(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}

		// /api/tenants/{tenantId}/data-sources[/{dsId}[/{action}]]
		if len(parts) >= 2 && parts[1] == "data-sources" {
			switch {
			// GET /api/tenants/{id}/data-sources/{dsId}/schema/context
			case len(parts) == 5 && parts[3] == "schema" && parts[4] == "context" && r.Method == http.MethodGet:
				schemaHandler.GetSchemaContext(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/query/repair
			case len(parts) == 5 && parts[3] == "query" && parts[4] == "repair" && r.Method == http.MethodPost:
				schemaHandler.RepairSQL(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/query
			case len(parts) == 4 && parts[3] == "query" && r.Method == http.MethodPost:
				schemaHandler.ExecuteSQL(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/sample
			case len(parts) == 4 && parts[3] == "sample" && r.Method == http.MethodPost:
				schemaHandler.GetSampleData(w, r)
				return

			// GET /api/tenants/{id}/data-sources/{dsId}/schema
			case len(parts) == 4 && parts[2] != "" && parts[3] == "schema" && r.Method == http.MethodGet:
				dataSourceHandler.GetDataSourceSchema(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/test
			case len(parts) == 4 && parts[3] == "test" && r.Method == http.MethodPost:
				dataSourceHandler.TestDataSourceConnection(w, r)
				return

			// GET/PUT/DELETE /api/tenants/{id}/data-sources/{dsId}
			case len(parts) == 3 && parts[2] != "":
				switch r.Method {
				case http.MethodGet:
					dataSourceHandler.GetDataSource(w, r)
				case http.MethodPut:
					dataSourceHandler.UpdateDataSource(w, r)
				case http.MethodDelete:
					dataSourceHandler.DeleteDataSource(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			// GET/POST /api/tenants/{id}/data-sources
			case len(parts) == 2:
				switch r.Method {
				case http.MethodGet:
					dataSourceHandler.ListDataSources(w, r)
				case http.MethodPost:
					dataSourceHandler.CreateDataSource(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
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
