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

	// AI 发现服务
	aiFindingService := service.NewAIFindingService(db, dataSourceService)
	aiFindingHandler := handler.NewAIFindingHandler(aiFindingService)

	// 语义模型服务
	semanticModelService := service.NewSemanticModelService(db, dataSourceService)
	semanticModelHandler := handler.NewSemanticModelHandler(semanticModelService)

	// 大屏服务
	dashboardService := service.NewDashboardService(db, dataSourceService, aiFindingService)
	dashboardHandler := handler.NewDashboardHandler(dashboardService)

	// 设置服务依赖（数据源 handler 需要其他服务的引用以支持自动发现）
	dataSourceHandler.SetAIFindingService(aiFindingService)
	dataSourceHandler.SetSemanticService(semanticModelService)
	dataSourceHandler.SetDashboardService(dashboardService)

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

		// /api/tenants/{tenantId}/ai-findings[/{findingId}]
		if len(parts) >= 2 && parts[1] == "ai-findings" {
			switch {
			// GET /api/tenants/{id}/ai-findings
			case len(parts) == 2 && r.Method == http.MethodGet:
				aiFindingHandler.ListFindings(w, r)
				return

			// DELETE /api/tenants/{id}/ai-findings/{findingId}
			case len(parts) == 3:
				if r.Method == http.MethodDelete {
					aiFindingHandler.DeleteFinding(w, r)
					return
				}
			}
		}

		// /api/tenants/{tenantId}/dashboards[/{dashboardId}[/{action}]]
		if len(parts) >= 2 && parts[1] == "dashboards" {
			switch {
			// POST /api/tenants/{id}/dashboards/{dashboardId}/regenerate
			case len(parts) == 4 && parts[3] == "regenerate" && r.Method == http.MethodPost:
				dashboardHandler.RegenerateDashboard(w, r)
				return

			// GET /api/tenants/{id}/dashboards/{dashboardId}/preview
			case len(parts) == 4 && parts[3] == "preview" && r.Method == http.MethodGet:
				dashboardHandler.GetDashboardPreview(w, r)
				return

			// GET/PUT/DELETE /api/tenants/{id}/dashboards/{dashboardId}
			case len(parts) == 3:
				switch r.Method {
				case http.MethodGet:
					dashboardHandler.GetDashboard(w, r)
				case http.MethodPut:
					dashboardHandler.UpdateDashboard(w, r)
				case http.MethodDelete:
					dashboardHandler.DeleteDashboard(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			// GET/POST /api/tenants/{id}/dashboards
			case len(parts) == 2:
				switch r.Method {
				case http.MethodGet:
					dashboardHandler.ListDashboards(w, r)
				case http.MethodPost:
					dashboardHandler.CreateDashboard(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}

		// More specific routes for data-sources sub-resources
		// /api/tenants/{tenantId}/data-sources/{dsId}/ai-findings[/{action}]
		if len(parts) >= 6 && parts[1] == "data-sources" && parts[3] == "ai-findings" {
			dataSourceID := parts[2]
			_ = dataSourceID

			switch {
			// GET /api/tenants/{id}/data-sources/{dsId}/ai-findings/stats
			case len(parts) == 6 && parts[5] == "stats" && r.Method == http.MethodGet:
				aiFindingHandler.GetFindingStats(w, r)
				return

			// GET /api/tenants/{id}/data-sources/{dsId}/ai-findings/summary
			case len(parts) == 6 && parts[5] == "summary" && r.Method == http.MethodGet:
				aiFindingHandler.GetInsightSummary(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/ai-findings/rediscover
			case len(parts) == 6 && parts[5] == "rediscover" && r.Method == http.MethodPost:
				aiFindingHandler.TriggerRediscovery(w, r)
				return

			// GET /api/tenants/{id}/data-sources/{dsId}/ai-findings[?type=xxx]
			case len(parts) == 5 && r.Method == http.MethodGet:
				aiFindingHandler.ListDataSourceFindings(w, r)
				return
			}
		}

		// /api/tenants/{tenantId}/data-sources/{dsId}/semantic-model[/{action}]
		if len(parts) >= 5 && parts[1] == "data-sources" && parts[3] == "semantic-model" {
			switch {
			// POST /api/tenants/{id}/data-sources/{dsId}/semantic-model/build
			case len(parts) == 5 && r.Method == http.MethodPost:
				semanticModelHandler.BuildSemanticCache(w, r)
				return

			// GET /api/tenants/{id}/data-sources/{dsId}/semantic-model
			case len(parts) == 5 && r.Method == http.MethodGet:
				semanticModelHandler.GetSemanticCache(w, r)
				return

			// GET /api/tenants/{id}/data-sources/{dsId}/semantic-model/context
			case len(parts) == 6 && parts[5] == "context" && r.Method == http.MethodGet:
				semanticModelHandler.GetSemanticContext(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/semantic-model/refresh
			case len(parts) == 6 && parts[5] == "refresh" && r.Method == http.MethodPost:
				semanticModelHandler.RefreshSemanticCache(w, r)
				return

			// POST /api/tenants/{id}/data-sources/{dsId}/semantic-model/nl2sql
			case len(parts) == 6 && parts[5] == "nl2sql" && r.Method == http.MethodPost:
				semanticModelHandler.NL2SQL(w, r)
				return
			}
		}

		// /api/tenants/{tenantId}/data-sources/{dsId}/dashboards/suggestions
		if len(parts) >= 6 && parts[1] == "data-sources" && parts[4] == "dashboards" && parts[5] == "suggestions" {
			if r.Method == http.MethodGet {
				dashboardHandler.GetLayoutSuggestions(w, r)
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
