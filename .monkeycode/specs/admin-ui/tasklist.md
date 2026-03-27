# BizLens 后台管理系统 - 实施任务清单

> 版本：v1.0.0
> 日期：2026-03-27

## 状态说明

| 状态 | 符号 | 说明 |
|------|------|------|
| 待开始 | `[ ]` | 尚未开始实施 |
| 进行中 | `[~]` | 正在实施 |
| 已完成 | `[x]` | 已完成实施 |
| 已跳过 | `[-]` | 因依赖或需求变更跳过 |

---

## Phase 1: 共享组件与基础设施

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 1.1 | 创建 `components/admin/shared/` 目录 | [ ] | - | AdminPageHeader, AdminToolbar, ConfirmModal, EmptyState, LoadingSkeleton, PagePagination, Toast |
| 1.2 | 创建 `lib/admin/types.ts` | [ ] | - | Admin 类型定义：Config, StorageConfig, AdminLog, EnhancedStats |
| 1.3 | 创建 `lib/admin/utils.ts` | [ ] | - | Admin 工具函数：formatSize, formatDate, getRoleBadge, getStatusBadge |
| 1.4 | 扩展 `lib/admin/api.ts` | [ ] | - | 新增 config/storage/logs API 调用 |
| 1.5 | 前端 Next.js API Routes 代理层 | [ ] | 1.4 | `/api/admin/config`, `/api/admin/storage`, `/api/admin/logs` |

---

## Phase 2: 仪表盘增强

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 2.1 | 后端 `EnhancedStats` 数据结构 | [ ] | - | 趋势数据、数据源健康、告警摘要 |
| 2.2 | `GET /api/admin/dashboard/enhanced` 端点 | [ ] | 2.1 | 返回增强版仪表盘数据 |
| 2.3 | `AdminDashboard.tsx` 组件 | [ ] | 2.2 | ECharts 趋势图表 + 数据源健康 + 告警摘要 |
| 2.4 | `DatasourceHealthChart.tsx` 组件 | [ ] | 2.3 | 数据源健康状态环形图 |
| 2.5 | `AlertSummary.tsx` 组件 | [ ] | 2.3 | 告警摘要卡片 |
| 2.6 | 仪表盘页面整合 | [ ] | 2.3, 2.4, 2.5 | `/admin/page.tsx` 整合新组件 |

---

## Phase 3: 用户管理完善

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 3.1 | `UserTable.tsx` 表格组件抽取 | [ ] | 1.1 | 从现有 `users/page.tsx` 抽取 |
| 3.2 | `UserFormModal.tsx` 添加/编辑弹窗 | [ ] | 1.1 | 支持 create/edit 两种模式 |
| 3.3 | `UserDetailPanel.tsx` 详情侧滑面板 | [ ] | 1.1 | 侧滑展示用户完整信息 |
| 3.4 | 角色筛选下拉 | [ ] | 3.1 | AdminToolbar 中增加筛选 |
| 3.5 | CSV 导入功能 | [ ] | 3.1 | 下载模板 + 上传 CSV 批量创建 |
| 3.6 | 用户管理页面重构 | [ ] | 3.1-3.5 | `/admin/users/page.tsx` 重构整合 |

---

## Phase 4: 数据资产管理完善

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 4.1 | `FileTable.tsx` 表格组件抽取 | [ ] | 1.1 | 从现有 `files/page.tsx` 抽取 |
| 4.2 | `FilePreview.tsx` 文件预览组件 | [ ] | 1.1 | 图片/PDF/CSV 预览 |
| 4.3 | 存储分布饼图 | [ ] | 4.1 | 页面顶部增加按格式分布 |
| 4.4 | `DatabaseTable.tsx` 表格组件抽取 | [ ] | 1.1 | 从现有 `databases/page.tsx` 抽取 |
| 4.5 | `DatabaseTestModal.tsx` 测试连接结果 | [ ] | 1.1 | 抽取测试连接结果弹窗 |
| 4.6 | 文件管理页面重构 | [ ] | 4.1-4.3 | `/admin/assets/files/page.tsx` |
| 4.7 | 数据库管理页面重构 | [ ] | 4.4, 4.5 | `/admin/assets/databases/page.tsx` |

---

## Phase 5: 系统配置

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 5.1 | `SystemConfig` 数据模型 | [ ] | - | `model.go` 追加 |
| 5.2 | `AdminLog` 数据模型 | [ ] | - | `model.go` 追加 |
| 5.3 | `AdminService` 配置管理方法 | [ ] | 5.1 | GetConfig, UpdateConfig, GetConfigCategory |
| 5.4 | `AdminService` 存储配置方法 | [ ] | 5.1 | GetStorageConfig, UpdateStorageConfig |
| 5.5 | `AdminService` 增强统计方法 | [ ] | 5.2 | GetEnhancedStats |
| 5.6 | `AdminService` 日志管理方法 | [ ] | 5.2 | ListLogs, WriteLog |
| 5.7 | 后端 Handler 扩展 | [ ] | 5.3-5.6 | GetConfig, UpdateConfig, GetStorage, UpdateStorage, ListLogs, GetEnhancedStats |
| 5.8 | 后端路由注册 | [ ] | 5.7 | `main.go` 追加新路由 |
| 5.9 | `ConfigSection.tsx` 配置区块组件 | [ ] | 1.1 | 从 `config/page.tsx` 抽取 |
| 5.10 | AI 配置表单组件 | [ ] | 1.1 | `AIConfigForm.tsx` |
| 5.11 | 告警配置表单组件 | [ ] | 1.1 | `AlertConfigForm.tsx` |
| 5.12 | 通知渠道表单组件 | [ ] | 1.1 | `NotificationConfigForm.tsx` |
| 5.13 | 数据策略表单组件 | [ ] | 1.1 | `RetentionConfigForm.tsx` |
| 5.14 | 配置子页面创建 | [ ] | 5.9-5.13 | `/admin/config/ai`, `/admin/config/alerts`, `/admin/config/notifications`, `/admin/config/retention` |
| 5.15 | 存储配置页面对接 API | [ ] | 5.7, 5.8 | `/admin/assets/storage/page.tsx` |

---

## Phase 6: 操作日志

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 6.1 | `LogTable.tsx` 日志表格组件 | [ ] | 1.1 | 操作类型、时间范围筛选 |
| 6.2 | `/admin/logs` 页面 | [ ] | 6.1, 5.6-5.8 | 操作日志列表页 |

---

## Phase 7: 优化与完善

| # | 任务 | 状态 | 依赖 | 说明 |
|---|------|------|------|------|
| 7.1 | 响应式布局优化 | [ ] | 所有 Phase | lg/md/sm 三档断点适配 |
| 7.2 | Toast 全局通知集成 | [ ] | 1.1 | Admin 全局 Toast Context |
| 7.3 | 前端权限守卫 Middleware | [ ] | - | Next.js Middleware 检查 admin 路由 |
| 7.4 | 加载骨架屏完善 | [ ] | 1.1 | 统一 LoadingSkeleton 在所有页面使用 |
| 7.5 | 可访问性检查 | [ ] | 所有 Phase | aria-label, focus-visible, keyboard nav |
| 7.6 | Admin 操作日志自动记录 | [ ] | 5.6, 5.7 | 在各 Handler 方法中调用 WriteLog |
| 7.7 | 日志自动清理定时任务 | [ ] | 6.1 | 保留 90 天自动删除 |

---

## 验收检查

- [ ] 所有页面通过 Lighthouse 可访问性审计（>= 90）
- [ ] 核心用户流程（添加用户 -> 编辑 -> 删除）端到端测试通过
- [ ] API 响应时间 < 500ms（不含复杂查询）
- [ ] 单元测试覆盖 Admin Service 核心方法
