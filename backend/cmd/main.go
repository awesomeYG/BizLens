package main

import (
	"ai-bi-server/internal/config"
	"ai-bi-server/internal/handler"
	"ai-bi-server/internal/middleware"
	"ai-bi-server/internal/model"
	"ai-bi-server/internal/service"
	"context"
	"fmt"
	"log"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// recoveryMiddleware 恢复中间件
func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic recovered: %v\n%s", err, debug.Stack())
				http.Error(w, fmt.Sprintf("Internal error: %v", err), http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

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

	// 统一生成字符串主键 ID（若模型存在 ID 字段且为空），避免插入 NULL 触发 not-null constraint。
	// SQLite/PostgreSQL 都适用；若业务已显式设置 ID，这里不会覆盖。
	db.Callback().Create().Before("gorm:before_create").Register("uuid_gen", func(tx *gorm.DB) {
		if tx == nil || tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}
		f := tx.Statement.Schema.LookUpField("ID")
		if f == nil {
			return
		}
		_, isZero := f.ValueOf(tx.Statement.Context, tx.Statement.ReflectValue)
		if isZero {
			tx.Statement.SetColumn("ID", uuid.NewString())
		}
	})

	// 初始化服务和 handler
	imService := service.NewIMService(db)
	imHandler := handler.NewIMHandler(imService)
	alertService := service.NewAlertService(db, imService)
	alertHandler := handler.NewAlertHandler(alertService)
	dataSourceService := service.NewDataSourceService(db)
	dataSourceHandler := handler.NewDataSourceHandler(dataSourceService)
	schemaHandler := handler.NewSchemaHandler(dataSourceService)
	notificationRuleService := service.NewNotificationRuleService(db, imService)
	notificationRuleHandler := handler.NewNotificationRuleHandler(notificationRuleService)
	analysisService := service.NewAnalysisService(db)
	analysisHandler := handler.NewAnalysisHandler(analysisService)
	aiConfigService := service.NewAIConfigService(db)

	// AutoQuery 服务（用于 dashboard 生成前的自动数据查询）
	autoQueryService := service.NewAutoQueryService(dataSourceService)
	autoQueryHandler := handler.NewAutoQueryHandler(autoQueryService)

	// WebSocket 实时推送服务
	wsHub := service.NewHub()
	go wsHub.Run()
	wsHandler := handler.NewWebSocketHandler(wsHub)
	// dashboardRefreshService 可在需要时启动（如 Dashboard 访问时）
	_ = service.NewDashboardRefreshService(wsHub, autoQueryService, dataSourceService, 5*time.Second)

	aiConfigHandler := handler.NewAIConfigHandler(aiConfigService)

	// 语义层服务
	metricService := service.NewMetricService(db)
	dimensionService := service.NewDimensionService(db)
	relationshipService := service.NewRelationshipService(db)
	// semanticQueryService := service.NewSemanticQueryService(db, metricService, dimensionService, relationshipService)
	metricHandler := handler.NewMetricHandler(metricService, dimensionService, relationshipService)

	// 大屏模板服务
	dashboardTemplateService := service.NewDashboardTemplateService(db)
	dashboardTemplateHandler := handler.NewDashboardTemplateHandler(dashboardTemplateService)

	// 数据集服务（手动上传）
	datasetService := service.NewDatasetService(db, "./uploads", 100*1024*1024) // 100MB
	datasetHandler := handler.NewDatasetHandler(datasetService, "./uploads")

	// 报表服务
	reportService := service.NewReportService(db)
	reportHandler := handler.NewReportHandler(reportService)
	chatService := service.NewChatService(db)
	chatHandler := handler.NewChatHandler(chatService)

	// 钉钉机器人双向对话服务
	dingtalkBotService := service.NewDingtalkBotService(db, imService)
	dingtalkStreamService := service.NewDingtalkStreamService(db, imService, dingtalkBotService)

	// 业务健康监控服务
	baselineService := service.NewBaselineService(db)
	anomalyService := service.NewAnomalyService(db, baselineService, imService)
	dailySummaryService := service.NewDailySummaryService(db, anomalyService, imService)
	schedulerService := service.NewSchedulerService(db, baselineService, anomalyService, dailySummaryService)
	anomalyHandler := handler.NewAnomalyHandler(anomalyService)

	// 根因分析引擎
	rcaService := service.NewRCAService(db, dataSourceService, metricService)
	rcaHandler := handler.NewRCAHandler(rcaService)

	// 每日摘要 Handler
	dailySummaryHandler := handler.NewDailySummaryHandler(dailySummaryService)

	// 观测中心统一 Handler
	observabilityHandler := handler.NewObservabilityHandler(db, anomalyService, dailySummaryService, baselineService, rcaService)

	// 注入数据依赖（延迟注入避免循环引用）
	dailySummaryService.SetDataDependencies(dataSourceService, metricService)
	dailySummaryService.SetRCADependency(rcaService)
	baselineService.SetDataDependencies(dataSourceService, metricService)
	schedulerService.SetDataDependencies(dataSourceService, metricService, imService)

	// 初始化系统预置模板
	if err := dashboardTemplateService.InitSystemTemplates(); err != nil {
		log.Printf("警告：系统模板初始化失败：%v", err)
	} else {
		log.Println("系统模板初始化完成")
	}

	// 认证服务
	authService, err := service.NewAuthService(db, cfg)
	if err != nil {
		log.Fatalf("创建认证服务失败：%v", err)
	}
	if err := authService.EnsureDemoAccount(); err != nil {
		log.Fatalf("初始化演示账号失败：%v", err)
	}
	log.Println("演示账号初始化完成：test@example.com")
	authHandler := handler.NewAuthHandler(authService)

	// 路由
	mux := http.NewServeMux()

	// 健康检查
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// WebSocket 实时推送（需要鉴权）
	mux.HandleFunc("/api/ws", func(w http.ResponseWriter, r *http.Request) {
		wsHandler.HandleWebSocket(w, r)
	})

	// 认证路由：/api/auth/[register|login|logout|refresh|me|change-password]
	mux.HandleFunc("/api/auth/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/auth/")

		switch {
		// POST /api/auth/register
		case path == "register" && r.Method == http.MethodPost:
			authHandler.Register(w, r)
			return

		// POST /api/auth/login
		case path == "login" && r.Method == http.MethodPost:
			authHandler.Login(w, r)
			return

		// POST /api/auth/logout (需要认证)
		case path == "logout" && r.Method == http.MethodPost:
			middleware.Auth(authService)(http.HandlerFunc(authHandler.Logout)).ServeHTTP(w, r)
			return

		// POST /api/auth/refresh
		case path == "refresh" && r.Method == http.MethodPost:
			authHandler.RefreshToken(w, r)
			return

		// GET /api/auth/me (需要认证)
		case path == "me" && r.Method == http.MethodGet:
			middleware.Auth(authService)(http.HandlerFunc(authHandler.GetCurrentUser)).ServeHTTP(w, r)
			return

		// PUT /api/auth/me (需要认证)
		case path == "me" && r.Method == http.MethodPut:
			middleware.Auth(authService)(http.HandlerFunc(authHandler.UpdateUser)).ServeHTTP(w, r)
			return

		// POST /api/auth/change-password (需要认证)
		case path == "change-password" && r.Method == http.MethodPost:
			middleware.Auth(authService)(http.HandlerFunc(authHandler.ChangePassword)).ServeHTTP(w, r)
			return

		default:
			http.NotFound(w, r)
		}
	})

	// 租户级路由（统一 JWT 认证）：/api/tenants/{tenantId}/...
	tenantRouter := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

		// POST /api/tenants/{id}/auto-query（dashboard 生成前的自动数据查询）
		if len(parts) == 2 && parts[1] == "auto-query" && r.Method == http.MethodPost {
			autoQueryHandler.AutoQuery(w, r)
			return
		}

		// /api/tenants/{tenantId}/ai-config
		if len(parts) == 2 && parts[1] == "ai-config" {
			switch r.Method {
			case http.MethodGet:
				aiConfigHandler.GetAIConfig(w, r)
			case http.MethodPut:
				aiConfigHandler.UpsertAIConfig(w, r)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
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

		// /api/tenants/{tenantId}/notification-rules[/{ruleId}[/{action}]]
		if len(parts) >= 2 && parts[1] == "notification-rules" {
			switch {
			// POST /api/tenants/{id}/notification-rules/parse-nl
			case len(parts) == 3 && parts[2] == "parse-nl" && r.Method == http.MethodPost:
				notificationRuleHandler.ParseNLQuery(w, r)
				return

			// POST /api/tenants/{id}/notification-rules/{ruleId}/trigger
			case len(parts) == 4 && parts[3] == "trigger" && r.Method == http.MethodPost:
				notificationRuleHandler.TriggerNotificationRule(w, r)
				return

			// POST /api/tenants/{id}/notification-rules/{ruleId}/toggle
			case len(parts) == 4 && parts[3] == "toggle" && r.Method == http.MethodPost:
				notificationRuleHandler.ToggleNotificationRule(w, r)
				return

			// GET/PUT/DELETE /api/tenants/{id}/notification-rules/{ruleId}
			case len(parts) == 3 && parts[2] != "":
				switch r.Method {
				case http.MethodGet:
					notificationRuleHandler.GetNotificationRule(w, r)
				case http.MethodPut:
					notificationRuleHandler.UpdateNotificationRule(w, r)
				case http.MethodDelete:
					notificationRuleHandler.DeleteNotificationRule(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			// GET/POST /api/tenants/{id}/notification-rules
			case len(parts) == 2:
				switch r.Method {
				case http.MethodGet:
					notificationRuleHandler.ListNotificationRules(w, r)
				case http.MethodPost:
					notificationRuleHandler.CreateNotificationRule(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}

		// /api/tenants/{tenantId}/metrics[/{metricId}[/{action}]]
		if len(parts) >= 2 && parts[1] == "metrics" {
			switch {
			// POST /api/tenants/{id}/metrics/auto-discover
			case len(parts) == 4 && parts[2] != "" && parts[3] == "auto-discover" && r.Method == http.MethodPost:
				metricHandler.AutoDiscoverMetrics(w, r)
				return

			// POST /api/tenants/{id}/metrics/confirm
			case len(parts) == 4 && parts[2] != "" && parts[3] == "confirm" && r.Method == http.MethodPost:
				metricHandler.ConfirmMetrics(w, r)
				return

			// GET/POST /api/tenants/{id}/metrics
			case len(parts) == 2:
				switch r.Method {
				case http.MethodGet:
					metricHandler.ListMetrics(w, r)
				case http.MethodPost:
					metricHandler.CreateMetric(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			// GET/PUT/DELETE /api/tenants/{id}/metrics/{metricId}
			case len(parts) == 3 && parts[2] != "":
				switch r.Method {
				case http.MethodGet:
					metricHandler.GetMetric(w, r)
				case http.MethodPut:
					metricHandler.UpdateMetric(w, r)
				case http.MethodDelete:
					metricHandler.DeleteMetric(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}

		// /api/tenants/{tenantId}/dimensions/auto-discover
		if len(parts) >= 2 && parts[1] == "dimensions" {
			switch {
			// POST /api/tenants/{id}/dimensions/auto-discover
			case len(parts) == 4 && parts[2] != "" && parts[3] == "auto-discover" && r.Method == http.MethodPost:
				metricHandler.AutoDiscoverDimensions(w, r)
				return
			}
		}

		// /api/tenants/{tenantId}/relationships/auto-discover
		if len(parts) >= 2 && parts[1] == "relationships" {
			switch {
			// POST /api/tenants/{id}/relationships/auto-discover
			case len(parts) == 4 && parts[2] != "" && parts[3] == "auto-discover" && r.Method == http.MethodPost:
				metricHandler.AutoDiscoverRelationships(w, r)
				return
			}
		}

		// /api/tenants/{tenantId}/dashboards/templates[/{id}[/generate]]
		if len(parts) >= 3 && parts[1] == "dashboards" && parts[2] == "templates" {
			dashboardTemplateHandler.HandleTemplates(w, r)
			return
		}

		// /api/tenants/{tenantId}/dashboards/instances[/{id}[/sections[/{sectionId}]]]
		if len(parts) >= 3 && parts[1] == "dashboards" && parts[2] == "instances" {
			dashboardTemplateHandler.HandleInstances(w, r)
			return
		}

		// /api/tenants/{tenantId}/reports[/{reportId}[/{action}]]
		if len(parts) >= 2 && parts[1] == "reports" {
			reportHandler.HandleReports(w, r)
			return
		}

		// /api/tenants/{tenantId}/anomalies[/detect]
		if len(parts) >= 2 && parts[1] == "anomalies" {
			switch {
			// GET /api/tenants/{id}/anomalies
			case len(parts) == 2 && r.Method == http.MethodGet:
				anomalyHandler.ListAnomalies(w, r)
				return
			// POST /api/tenants/{id}/anomalies/detect
			case len(parts) == 3 && parts[2] == "detect" && r.Method == http.MethodPost:
				anomalyHandler.TriggerDetection(w, r)
				return
			}
		}

		// /api/tenants/{tenantId}/chat-conversations[/{conversationId}]
		if len(parts) >= 2 && parts[1] == "chat-conversations" {
			chatHandler.HandleConversations(w, r)
			return
		}

		// /api/tenants/{tenantId}/analysis/[query|evaluation]
		if len(parts) >= 3 && parts[1] == "analysis" {
			switch {
			case len(parts) == 3 && parts[2] == "query" && r.Method == http.MethodPost:
				analysisHandler.AnalyzeQuestion(w, r)
				return
			case len(parts) == 3 && parts[2] == "evaluation" && r.Method == http.MethodGet:
				analysisHandler.GetAnalysisEvaluation(w, r)
				return
			}
		}

		// /api/tenants/{tenantId}/rca[/analyze]
		if len(parts) >= 2 && parts[1] == "rca" {
			rcaHandler.HandleRCA(w, r)
			return
		}

		// /api/tenants/{tenantId}/daily-summary[/latest|/generate]
		if len(parts) >= 2 && parts[1] == "daily-summary" {
			dailySummaryHandler.HandleDailySummary(w, r)
			return
		}

		// /api/tenants/{tenantId}/observability/...
		if len(parts) >= 2 && parts[1] == "observability" {
			observabilityHandler.HandleObservability(w, r)
			return
		}

		http.NotFound(w, r)
	})
	mux.Handle("/api/tenants/", middleware.Auth(authService)(tenantRouter))

	// 数据集路由：/api/datasets[/upload/file]（需要 JWT 认证）
	datasetRouter := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/datasets/")

		// POST /api/datasets/upload/file
		if path == "upload/file" && r.Method == http.MethodPost {
			datasetHandler.UploadFile(w, r)
			return
		}

		// GET /api/datasets - 列出数据集
		if path == "" && r.Method == http.MethodGet {
			datasetHandler.ListDatasets(w, r)
			return
		}

		// DELETE /api/datasets/?id=xxx - 通过 query param 删除
		if path == "" && r.Method == http.MethodDelete {
			id := r.URL.Query().Get("id")
			if id == "" {
				http.Error(w, `{"error":"缺少文件 ID"}`, http.StatusBadRequest)
				return
			}
			datasetHandler.DeleteDataset(w, r, id)
			return
		}

		// /api/datasets/{id}/...
		parts := strings.Split(strings.Trim(path, "/"), "/")
		if len(parts) >= 1 && parts[0] != "" {
			datasetID := parts[0]

			switch {
			case len(parts) == 1:
				switch r.Method {
				case http.MethodGet:
					datasetHandler.GetDataset(w, r, datasetID)
				case http.MethodDelete:
					datasetHandler.DeleteDataset(w, r, datasetID)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return

			case len(parts) == 2 && parts[1] == "preview":
				if r.Method == http.MethodGet {
					datasetHandler.GetDatasetPreview(w, r, datasetID)
				}
				return

			case len(parts) == 2 && parts[1] == "quality":
				if r.Method == http.MethodGet {
					datasetHandler.GetQualityIssues(w, r, datasetID)
				}
				return
			case len(parts) == 3 && parts[1] == "clean":
				if parts[2] == "operations" && r.Method == http.MethodGet {
					datasetHandler.GetCleanOperations(w, r, datasetID)
					return
				}
				if r.Method == http.MethodPost {
					datasetHandler.ExecuteClean(w, r, datasetID)
					return
				}

			case len(parts) == 2 && parts[1] == "sensitive":
				if r.Method == http.MethodGet {
					datasetHandler.DetectSensitiveData(w, r, datasetID)
					return
				}

			case len(parts) == 2 && parts[1] == "mask":
				if r.Method == http.MethodPost {
					datasetHandler.MaskSensitiveData(w, r, datasetID)
					return
				}
			}
		}

		http.NotFound(w, r)
	})
	mux.Handle("/api/datasets/", middleware.Auth(authService)(datasetRouter))

	// 启动钉钉 Stream 客户端（异步）
	go func() {
		if err := dingtalkStreamService.StartAll(context.Background()); err != nil {
			log.Printf("钉钉 Stream 客户端启动失败：%v", err)
		}
	}()

	// 启动业务健康监控调度服务
	schedulerService.Start()

	// 启动服务
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("服务启动在 %s", addr)
	if err := http.ListenAndServe(addr, recoveryMiddleware(mux)); err != nil {
		log.Fatalf("服务启动失败：%v", err)
	}
}
