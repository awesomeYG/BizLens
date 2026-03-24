# 统一数据源管理 -- 技术设计文档

> 版本: 1.0
> 日期: 2026-03-24
> 状态: 待评审

## 1. 设计概览

将现有分散在两个页面（`/data-sources` 和 `/settings/files`）的数据源管理功能合并为一个统一页面，采用 Tab 切换模式。前端重组页面结构，后端统一认证方式。

### 1.1 架构变更概要

```
变更前:
  /data-sources          --> DataSourcesPage (数据库配置, localStorage 持久化)
  /settings/files        --> FilesSettingsPage (文件上传, 后端 API)

变更后:
  /data-sources          --> UnifiedDataSourcePage
                              |-- Tab: 数据库连接  --> DatabaseConnectionTab (组件提取)
                              |-- Tab: 上传文件    --> FileUploadTab (组件提取)
  /data-sources/clean    --> DataCleanPage (保持不变)
```

## 2. 前端设计

### 2.1 页面结构

#### 2.1.1 统一入口页面 `/data-sources/page.tsx`

重构为 Tab 容器组件，管理 Tab 状态和子组件渲染：

```tsx
// frontend/app/data-sources/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DatabaseConnectionTab from "./components/DatabaseConnectionTab";
import FileUploadTab from "./components/FileUploadTab";

const TABS = [
  { key: "databases", label: "数据库连接" },
  { key: "files", label: "上传文件" },
] as const;

function DataSourceContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "files" ? "files" : "databases";
  const [activeTab, setActiveTab] = useState<"databases" | "files">(initialTab);

  return (
    <main>
      {/* 页面标题 */}
      {/* Tab 切换栏 */}
      {/* 根据 activeTab 渲染对应组件 */}
      {activeTab === "databases" ? <DatabaseConnectionTab /> : <FileUploadTab />}
    </main>
  );
}
```

#### 2.1.2 组件提取

| 新组件文件 | 来源 | 说明 |
|-----------|------|------|
| `frontend/app/data-sources/components/DatabaseConnectionTab.tsx` | 从 `data-sources/page.tsx` 提取 | 数据库连接配置的完整逻辑 |
| `frontend/app/data-sources/components/FileUploadTab.tsx` | 从 `settings/files/page.tsx` 迁移 | 文件上传管理的完整逻辑 |

两个 Tab 组件保持各自的独立状态，互不干扰。

### 2.2 Tab 切换设计

- Tab 切换使用客户端状态管理（`useState`），不触发路由变化
- URL query 参数 `?tab=files` 仅用于外部直链和浮动按钮跳转
- Tab 切换时通过条件渲染显示对应组件，隐藏的组件不卸载（使用 CSS `display: none` 或 `hidden` 属性），保持状态
- 用户在"数据库连接" Tab 填写了一半表单后切换到"上传文件" Tab 再切回来，表单内容不丢失

### 2.3 数据库连接 Tab 改造

当前 `/data-sources/page.tsx` 的数据源列表保存在 localStorage（通过 `saveOnboardingDraft`）。按照用户偏好"数据存数据库，不用 localStorage 做持久化"，需改造为调用后端 API：

| 操作 | 当前方式 | 改造后 |
|------|---------|-------|
| 获取列表 | `getCurrentUser().dataSources` (localStorage) | `GET /api/tenants/{id}/data-sources` (后端 API) |
| 创建数据源 | `saveOnboardingDraft(...)` (localStorage) | `POST /api/tenants/{id}/data-sources` (后端 API) |
| 测试连接 | `POST /api/data-source/test` (前端 API Route) | `POST /api/tenants/{id}/data-sources/{dsId}/test` (后端 API) 或保留前端 API Route 用于创建前的预检 |

认证方式：从 localStorage 获取 JWT token，附加到 `Authorization` header。

### 2.4 导航入口调整

| 组件 | 当前状态 | 变更 |
|------|---------|------|
| `SimpleChatPanel.tsx` 顶栏 | "数据源" -> `/data-sources` | 不变 |
| `settings/layout.tsx` 侧边栏 | 包含"文件管理" -> `/settings/files` | 移除"文件管理"导航项 |
| `FloatingSettingsButton.tsx` | 跳转 `/settings/files` | 改为 `/data-sources?tab=files` |
| `settings/files/page.tsx` | 独立页面 | 改为重定向到 `/data-sources?tab=files` |

### 2.5 页面视觉设计

```
+------------------------------------------------------------------+
| [< BizLens] / 数据源管理        [AI 对话]  [智能告警]  [退出登录]   |
+------------------------------------------------------------------+
|                                                                    |
|  [数据源管理]                                                       |
|  统一管理所有数据来源，支持数据库连接和文件上传                          |
|                                                                    |
|  [== 数据库连接 ==]  [ 上传文件 ]                                    |
|  --------------------------------------------------------         |
|                                                                    |
|  +-- 已保存数据源 -----+  +-- 新增数据源 ----------------+          |
|  | (数据源卡片列表)      |  | 数据源名称: [___________]   |          |
|  | ...                  |  | 数据源类型: [MySQL    v]   |          |
|  |                      |  | Host: [___________]       |          |
|  |                      |  | Port: [___________]       |          |
|  |                      |  | ...                       |          |
|  |                      |  | [测试连接] [保存并继续添加] |          |
|  +----------------------+  +---------------------------+          |
+------------------------------------------------------------------+
```

切换到"上传文件" Tab 后：

```
  [ 数据库连接 ]  [== 上传文件 ==]
  --------------------------------------------------------

  [文件总数: 5]  [总存储: 12.3MB]  [质量: 87%]  [处理中: 0]

  +------------------------------------------------------+
  |  拖拽文件到此处，或点击上传                              |
  |  支持 xlsx、xls、csv、json、xml                        |
  +------------------------------------------------------+

  文件列表
  +------------------------------------------------------+
  | 文件信息 | 格式 | 大小 | 数据量 | 质量 | 状态 | 操作    |
  | ...      | CSV  | 2MB  | 1000行 | 95%  | 可用 | 清洗 X |
  +------------------------------------------------------+
```

## 3. 后端设计

### 3.1 认证统一

当前数据库数据源 API 不需要 JWT 认证（从 URL path 取 tenantId），文件数据集 API 需要 JWT。统一为 JWT 认证：

**方案**: 在 `backend/cmd/main.go` 中，将 data-sources 路由也包裹到 `middleware.Auth` 中间件内。

```go
// 变更前
mux.HandleFunc("/api/tenants/", tenantRouter)  // 无认证

// 变更后
mux.Handle("/api/tenants/", middleware.Auth(authService)(http.HandlerFunc(tenantRouter)))
```

数据源 handler 中的 `parseTenantID(r)` 改为从 JWT context 获取：

```go
// 变更前
func parseTenantID(r *http.Request) string {
    // 从 URL path 解析 tenantId
}

// 变更后
func parseTenantID(r *http.Request) string {
    if tid := r.Context().Value("tenantID"); tid != nil {
        return tid.(string)
    }
    // fallback: 从 URL path 解析（向后兼容）
    return parseTenantIDFromPath(r)
}
```

### 3.2 API 路由

保持现有的 API 路由结构不变，避免大规模迁移：

| 路由 | 认证 | 变更 |
|------|------|------|
| `/api/tenants/{id}/data-sources/*` | JWT (新增) | 增加 JWT 中间件 |
| `/api/datasets/*` | JWT (保持) | 不变 |

**不迁移 `/api/datasets/*` 路由到 `/api/tenants/{id}/data-sources/datasets/*`** 的理由：
1. 迁移成本高（前后端联动修改量大）
2. 两者后端模型不同（`DataSource` vs `UploadedDataset`），独立路由更清晰
3. 统一体验已在前端层面通过 Tab 实现

### 3.3 数据迁移

当前数据库数据源保存在 localStorage 中（仅部分已通过后端 API 创建），需要确保所有数据源都通过后端 API 管理。

**迁移策略**：
1. 前端在首次加载统一页面时，检查 localStorage 中的 `dataSources` 数据
2. 如果存在旧数据，逐条调用 `POST /api/tenants/{id}/data-sources` 写入后端
3. 迁移成功后清除 localStorage 中的 `dataSources` 字段
4. 后续所有操作只通过后端 API

## 4. 文件变更清单

### 4.1 新增文件

| 文件路径 | 说明 |
|---------|------|
| `frontend/app/data-sources/components/DatabaseConnectionTab.tsx` | 数据库连接 Tab 组件 |
| `frontend/app/data-sources/components/FileUploadTab.tsx` | 文件上传 Tab 组件 |

### 4.2 修改文件

| 文件路径 | 变更内容 |
|---------|---------|
| `frontend/app/data-sources/page.tsx` | 重构为 Tab 容器，提取子组件 |
| `frontend/app/settings/layout.tsx` | 移除"文件管理"导航项 |
| `frontend/app/settings/files/page.tsx` | 改为重定向到 `/data-sources?tab=files` |
| `frontend/components/FloatingSettingsButton.tsx` | 跳转链接改为 `/data-sources?tab=files` |
| `backend/cmd/main.go` | data-sources 路由增加 JWT 认证中间件 |
| `backend/internal/handler/data_source_handler.go` | `parseTenantID` 支持从 JWT context 获取 |

### 4.3 不变文件

| 文件路径 | 原因 |
|---------|------|
| `frontend/app/data-sources/clean/page.tsx` | 清洗页面路由和功能不变 |
| `frontend/components/SimpleChatPanel.tsx` | "数据源"按钮已指向 `/data-sources` |
| `backend/internal/handler/dataset_handler.go` | API 路由保持不变 |
| `backend/internal/model/model.go` | DataSource 模型不变 |
| `backend/internal/model/dataset.go` | UploadedDataset 模型不变 |

## 5. 关键技术决策

### D-01: Tab 状态保持方案

**决策**: 使用 CSS `hidden` 控制 Tab 内容的显隐，而非条件渲染。

**理由**: 条件渲染（`{activeTab === "databases" && <DatabaseConnectionTab />}`）会导致切换 Tab 时组件卸载，表单状态丢失。使用 `hidden` 属性或 `display: none` 可以保持组件挂载，状态不丢失。

```tsx
<div className={activeTab !== "databases" ? "hidden" : ""}>
  <DatabaseConnectionTab />
</div>
<div className={activeTab !== "files" ? "hidden" : ""}>
  <FileUploadTab />
</div>
```

### D-02: 后端模型不合并

**决策**: 保持 `DataSource` 和 `UploadedDataset` 两个独立模型。

**理由**:
- 两者的字段差异大（数据库连接需要 Host/Port/Username/Password，文件需要 FileName/FileSize/Schema/QualityScore）
- 合并会导致大量冗余字段或复杂的多态设计
- 统一体验已在前端 Tab 层面实现，后端保持职责清晰更有利于维护

### D-03: API 路由不合并

**决策**: 保持 `/api/tenants/{id}/data-sources/*` 和 `/api/datasets/*` 两套独立路由。

**理由**:
- 两者的 CRUD 语义不同（数据库连接侧重配置管理，文件数据集侧重文件生命周期）
- 文件数据集有独特的操作（上传/预览/清洗/脱敏），与数据库连接的操作（连接测试/Schema获取/SQL执行）完全不同
- 合并路由会增加后端路由分发的复杂度

### D-04: 数据库数据源认证方式

**决策**: 统一为 JWT 认证，兼容 URL path 中的 tenantId。

**理由**:
- 安全性提升（当前数据源 API 无认证，任何人知道 tenantId 即可操作）
- 与文件数据集 API 认证方式一致
- 兼容 URL path tenantId 用于平滑过渡

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| localStorage 数据迁移失败 | 用户丢失已配置的数据源 | 迁移前备份、失败时保留 localStorage 数据并提示用户 |
| 旧路由书签失效 | 用户无法通过旧链接访问 | `/settings/files` 自动重定向到新页面 |
| 认证中间件添加后影响现有功能 | onboarding 流程中断 | 确保 onboarding 页面的数据源创建也携带 JWT token |
