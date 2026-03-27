# 后台管理功能需求文档

> BizLens AI 数据分析平台 - 后台管理系统

## 1. 概述与目标

### 1.1 背景

BizLens 以 **SaaS 授权模式**交付。客户购买后自行部署，系统不预设任何账号。部署完成的第一个管理员必须通过**授权码**完成激活注册，之后才能使用系统并管理其他用户。

**核心变化：**
- 不再硬编码 `koala@qq.com / admin123` 等预设账号
- 首次访问时进入**激活引导页**，输入授权码 + 管理员账号密码
- 管理员激活后，在后台管理中自主添加用户和管理员账号
- 普通用户（member）由管理员创建，或通过公开邀请链接注册（可选）

### 1.2 目标

1. **授权码激活流程**：部署后管理员凭授权码激活系统
2. **集中后台管理** `/admin`：统一纳管数据资产、租户用户、系统配置
3. **管理员自主运营**：管理员可在后台自主添加/管理用户，无需重新部署

### 1.3 UI 风格决策

**决策：延续现有风格，独立路由 `/admin`**

- 复用现有 `globals.css` 设计系统（深色主题 + 毛玻璃 + Tailwind）
- 复用现有 `AppHeader` 组件，统一顶部导航
- 独立 `AdminLayout` 提供侧边导航
- 激活页面使用与登录页一致的视觉风格

---

## 2. 授权码激活流程（核心新增）

### 2.1 授权码设计

**格式：**
```
XXXX-XXXX-XXXX-XXXX  （大写字母 + 数字，4段各4位，共16位）
```

**示例：** `BIZL-8K3M-A7PW-2N9Q`

**存储方式：**
- 环境变量 `LICENSE_KEY`：单实例授权码（生产部署时配置）
- 环境变量 `LICENSE_SEATS`：可选，最大用户数限制（如 `LICENSE_SEATS=50`），不填则不限制
- 授权码验证在后端 `auth_service.go` 中完成，**不在前端存储**

**验证规则：**
1. 授权码与环境变量 `LICENSE_KEY` 完全匹配（区分大小写）
2. 校验通过后，该授权码在系统中标记为"已使用"（防止同一授权码重复激活）
3. 若配置了 `LICENSE_SEATS`，检查当前用户数是否达到上限

**扩展性（未来）：**
- 可扩展为在线 license 验证（连接授权服务器校验），但第一版仅做本地校验

### 2.2 系统状态枚举

```
UNACTIVATED  →  未激活（没有任何 owner/admin 用户时为此状态）
ACTIVATED    →  已激活（至少有一个 owner 用户存在）
```

**状态判断逻辑：**
- 查询 `users` 表中 `role IN ('owner', 'admin')` 的记录数
- 数量为 0 → 系统处于 UNACTIVATED 状态
- 数量 > 0 → 系统处于 ACTIVATED 状态

### 2.3 激活引导页面（/auth/activate）

**触发条件：**
- 用户访问 `/auth/login` 时，后端检测到 UNACTIVATED 状态
- 前端收到 `unactivated: true` 响应后，自动 redirect 到 `/auth/activate`

**页面设计：**
- 与登录页视觉风格一致（深色背景、品牌色强调）
- 标题："激活系统"（替代"登录"）
- 副标题："请输入授权码和管理员信息完成系统激活"
- 表单字段：
  1. 授权码（4段输入框，每段4字符，支持粘贴自动跳格）
  2. 管理员姓名
  3. 管理员邮箱（作为登录账号）
  4. 设置密码（6位以上）
  5. 确认密码
- "已有账号？登录" 链接（如果已有管理员账号）

**交互流程：**
```
用户输入授权码 + 管理员信息 → 点击"激活系统"
  → 调用 POST /api/auth/activate
  → 授权码校验（在后端比对环境变量）
  → 创建 owner 用户 + 生成 JWT token
  → 返回 token，重定向到 /onboarding 或 /chat
```

**错误处理：**
- 授权码错误："授权码无效，请检查后重试"
- 授权码已使用（如果做了在线验证）："此授权码已被使用"
- 用户数达上限："已达到授权用户数上限，请联系供应商"
- 邮箱已被注册："此邮箱已被注册"

### 2.4 后端激活 API

**`POST /api/auth/activate`**

请求体：
```json
{
  "licenseKey": "BIZL-8K3M-A7PW-2N9Q",
  "name": "系统管理员",
  "email": "admin@company.com",
  "password": "password123"
}
```

响应（成功）：
```json
{
  "activated": true,
  "user": {
    "id": "...",
    "name": "系统管理员",
    "email": "admin@company.com",
    "role": "owner"
  },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 1800
  }
}
```

响应（失败）：
```json
{
  "error": "授权码无效",
  "code": "INVALID_LICENSE_KEY"
}
```

**后端处理逻辑：**
1. 校验 `LICENSE_KEY` 环境变量（必须非空）
2. 比对用户输入的 licenseKey 与环境变量
3. 创建租户（如果还未创建 default 租户）
4. 创建用户，role 设为 `owner`
5. 生成 JWT token 返回
6. 在 SystemConfig 中记录激活时间戳 `activated_at`

### 2.5 登录页面适配

**`GET /api/auth/login` 响应增加字段：**

```json
{
  "unactivated": true | false,
  "systemName": "BizLens",
  "version": "1.0.0"
}
```

- 若 `unactivated: true`，前端不显示邮箱/密码登录表单，改为显示：
  - "系统尚未激活" 提示
  - "前往激活" 按钮（跳转 `/auth/activate`）
- 若 `unactivated: false`，正常显示登录表单

### 2.6 移除预设账号

**删除 `auth_service.go` 中的以下代码：**

```go
// 删除以下内容：
const (
    adminEmail    = "koala@qq.com"
    adminName     = "管理员"
    adminPassword = "admin123"
)

func (s *AuthService) EnsureAdminAccount() error { ... }
```

**修改 `main.go` 启动逻辑：**

```go
// 删除以下调用：
if err := authService.EnsureAdminAccount(); err != nil {
    log.Fatalf("初始化超管账号失败：%v", err)
}
log.Println("超管账号初始化完成：koala@qq.com / admin123")

// 替换为：
// 仅确保 default 租户存在（激活后需要）
if err := authService.EnsureDefaultTenant(); err != nil {
    log.Fatalf("初始化默认组织失败：%v", err)
}
log.Println("默认组织初始化完成")
```

### 2.7 注册流程调整

**普通注册（`POST /api/auth/register`）：**
- 系统已激活时：任何人可以通过邮箱密码注册为 `member`
- 系统未激活时：返回错误 "系统尚未激活，请先激活"

**邀请注册（`POST /api/auth/invite-register`，可选扩展）：**
- 管理员生成分享链接（含 token），被邀请人通过链接注册
- 被邀请人只能注册为 `member`，不可自选 role

---

## 3. 后台管理功能

### 3.1 后台管理入口

**3.1.1 入口显示条件**
- 仅 `role === 'owner' || role === 'admin'` 的用户可见
- 在 AppHeader 导航栏增加"管理"菜单（下拉形式）

**3.1.2 导航结构**
```
BizLens
├── AI 对话          /chat
├── 洞察            /insights
├── 观测中心        /dashboards
├── 报表            /reports
├── 告警            /alerts
├── 设置            /settings/*
└── 管理            /admin/*
    ├── 仪表盘        /admin
    ├── 数据资产      /admin/assets
    │   ├── 文件管理  /admin/assets/files
    │   ├── 数据库    /admin/assets/databases
    │   └── 存储配置  /admin/assets/storage
    ├── 用户管理      /admin/users
    └── 系统配置      /admin/config
```

> **注：** 如果是单租户模式（默认部署），则不显示"租户管理"菜单，改为直接的"用户管理"。

### 3.2 仪表盘（/admin）

**功能：**
- 展示系统总览卡片：总用户数、总文件数、总数据库连接数、存储总量
- 最近上传文件列表（5条）
- 存储使用情况概览（格式分布）
- 系统状态：已激活时间、授权码状态

**数据来源：**
- 调用后端 `/api/admin/stats` 获取汇总数据
- 仅 owner/admin 可访问

### 3.3 用户管理（/admin/users）

**这是管理员自主运营的核心页面。**

**功能：**
- 用户列表：用户名、邮箱、角色（owner/admin/member）、创建时间、最后登录、状态
- 支持搜索（邮箱、用户名）
- 支持分页
- 用户操作：
  - **添加用户**：用户名、邮箱、初始密码（可选）、角色选择
  - **编辑用户**：修改用户名、切换角色
  - **重置密码**：系统生成随机密码或管理员设置
  - **禁用/启用**：禁用后该用户无法登录
  - **删除用户**：删除后不可恢复

**交互细节：**
- 创建/编辑用户弹窗表单
- 删除需二次确认（显示用户名确认）
- 重置密码后显示新密码（管理员可见一次）
- 不可删除自己的账号
- owner 不可被删除，只能转移 ownership

**角色说明：**
| 角色 | 说明 |
|-----|-----|
| owner | 系统所有者，唯一，不可删除，可转让 |
| admin | 管理员，可管理所有用户和数据资产 |
| member | 普通成员，只能使用功能，无法进入管理后台 |

### 3.4 数据资产管理

#### 3.4.1 文件管理（/admin/assets/files）

**功能：**
- 列出所有上传文件（支持筛选文件类型、上传时间）
- 文件列表字段：文件名、文件大小、格式、上传时间、状态、操作
- 支持按文件名搜索
- 支持分页
- 操作：预览（图片/PDF）、下载、删除
- 批量选择并删除

#### 3.4.2 数据库连接管理（/admin/assets/databases）

**功能：**
- 列出所有数据库连接配置（支持筛选类型、连接状态）
- 连接操作：测试连接、查看详情、删除
- 详情弹窗展示连接信息（密码脱敏）

#### 3.4.3 存储配置（/admin/assets/storage）

**功能：**
- 配置存储后端：本地 / S3 / MinIO
- 存储使用统计：各类型文件占用空间
- 清理过期文件

### 3.5 系统配置（/admin/config）

**功能：**
- AI 模型默认配置
- 告警全局配置（默认通知渠道、冷却时间）
- 数据保留策略（文件保留天数）
- API 限流配置

---

## 4. 非功能需求

### 4.1 权限控制

- `/auth/activate` 页面：任何人都可以访问（系统未激活时）
- `/admin/*` 页面：需 owner 或 admin 角色
- 未授权用户访问 `/admin/*` 时重定向到 `/chat`

### 4.2 激活状态安全

- `LICENSE_KEY` 环境变量必须配置，若未配置则后端启动时报错并退出
- 激活 API 有频率限制（5分钟内最多尝试 5 次），防止暴力破解

### 4.3 性能要求

- 列表 API 支持分页（默认 20 条/页）
- 文件列表加载时间 < 2s

### 4.4 安全要求

- 密码字段在前端不显示，传输时加密（bcrypt）
- 敏感配置（API Key、数据库密码）脱敏展示
- 所有 admin API 需 JWT 认证
- 关键操作（删除用户、清空存储）需二次确认
- 管理员重置用户密码后，密码明文仅展示一次

---

## 5. 环境变量清单

| 变量名 | 必填 | 说明 | 示例 |
|-------|-----|-----|------|
| `LICENSE_KEY` | **是** | 授权码，16位格式 | `BIZL-8K3M-A7PW-2N9Q` |
| `LICENSE_SEATS` | 否 | 最大用户数限制 | `50` |
| `LICENSE_EXPIRES` | 否 | 授权到期日期（YYYY-MM-DD），不填则永不过期 | `2027-12-31` |
| `JWT_SECRET` | 是 | JWT 签名密钥（生产环境必须修改） | `your-secret-here` |
| `SERVER_PORT` | 否 | 后端端口，默认 `3001` | `3001` |
| `DB_*` | 否 | 数据库连接配置 | 见 config.go |

---

## 6. 里程碑

### Phase 0: 授权码激活（优先实施）
- [ ] 移除预设账号 `EnsureAdminAccount`
- [ ] 新增 `POST /api/auth/activate` API
- [ ] 登录接口增加 `unactivated` 状态
- [ ] 激活页面 `/auth/activate`
- [ ] `LICENSE_KEY` 环境变量校验

### Phase 1: 后台框架
- [ ] AdminLayout + 侧边导航
- [ ] AppHeader 管理入口
- [ ] Admin 权限守卫
- [ ] 仪表盘页面

### Phase 2: 用户管理
- [ ] 用户列表页面
- [ ] 添加/编辑/删除用户 API + 页面
- [ ] 重置密码功能

### Phase 3: 数据资产管理
- [ ] 文件管理列表
- [ ] 数据库连接管理
- [ ] 存储配置页面

### Phase 4: 系统配置
- [ ] 各配置区块表单

---

## 7. 验收标准

1. **激活流程**：无预设账号，首次访问必须通过授权码激活
2. **授权码校验**：错误的授权码无法激活系统
3. **管理员权限**：激活用户自动成为 owner，可添加其他用户
4. **用户管理**：owner/admin 可以在后台添加、编辑、禁用、删除用户
5. **角色控制**：member 角色无法访问 `/admin/*`
6. **激活状态判断**：已有管理员时，登录页显示正常登录表单
7. **环境变量校验**：未配置 `LICENSE_KEY` 时后端启动失败并给出明确错误信息
8. **视觉一致**：激活页面与登录页风格一致，后台管理与主站风格一致
