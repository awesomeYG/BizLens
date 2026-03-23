# 用户认证系统实现文档

## 概述

本文档描述了 BizLens 智能 BI 分析平台的用户认证系统实现，包括后端 API 和前端集成。

## 功能特性

### 后端功能
- ✅ 用户注册（带租户 ID）
- ✅ 用户登录（支持暴力破解防护）
- ✅ JWT Access Token + Refresh Token 双令牌机制
- ✅ Token 自动刷新
- ✅ 密码加密存储（BCrypt）
- ✅ 角色权限控制（owner/admin/member）
- ✅ 账户锁定保护（连续失败 5 次锁定 30 分钟）
- ✅ 受保护的路由中间件

### 前端功能
- ✅ 登录页面
- ✅ 注册页面
- ✅ 自动 Token 管理
- ✅ 请求自动注入 Token
- ✅ Token 过期自动刷新
- ✅ 路由守卫组件
- ✅ 用户认证状态管理

## API 接口

### 1. 用户注册
```
POST /api/auth/register
Content-Type: application/json

{
  "tenantId": "acme-corp",
  "name": "张三",
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "user": {
    "id": "uuid",
    "tenantId": "acme-corp",
    "name": "张三",
    "email": "user@example.com",
    "role": "member",
    "createdAt": "2026-03-23T10:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "dGhpcyBp...",
    "expiresIn": 1800
  }
}
```

### 2. 用户登录
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response: 同注册接口
```

### 3. 刷新 Token
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "dGhpcyBp..."
}

Response:
{
  "accessToken": "new_eyJhbGc...",
  "refreshToken": "new_dGhpcyBp...",
  "expiresIn": 1800
}
```

### 4. 获取当前用户
```
GET /api/auth/me
Authorization: Bearer <accessToken>

Response:
{
  "id": "uuid",
  "tenantId": "acme-corp",
  "name": "张三",
  "email": "user@example.com",
  "role": "member",
  "lastLoginAt": "2026-03-23T10:00:00Z",
  "createdAt": "2026-03-23T10:00:00Z"
}
```

### 5. 更新用户信息
```
PUT /api/auth/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "新名字",
  "email": "newemail@example.com"
}
```

### 6. 修改密码
```
POST /api/auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "oldPassword": "old_password",
  "newPassword": "new_password"
}
```

### 7. 用户登出
```
POST /api/auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "refreshToken": "dGhpcyBp..."
}
```

## 项目结构

### 后端
```
backend/
├── cmd/
│   └── main.go                 # 主入口，路由注册
├── internal/
│   ├── config/
│   │   └── config.go           # 配置加载（含 JWT 配置）
│   ├── dto/
│   │   └── auth_dto.go         # 认证相关 DTO
│   ├── handler/
│   │   └── auth_handler.go     # 认证 HTTP 处理器
│   ├── middleware/
│   │   ├── auth.go             # JWT 认证中间件
│   │   └── cors.go             # CORS 中间件
│   ├── model/
│   │   └── model.go            # 数据模型（User, RefreshToken, AuthProvider）
│   └── service/
│       └── auth_service.go     # 认证业务逻辑
└── .env.example                # 环境变量示例
```

### 前端
```
frontend/
├── app/
│   └── auth/
│       ├── login/
│       │   └── page.tsx        # 登录页面
│       └── register/
│           └── page.tsx        # 注册页面
├── components/
│   └── auth-guard.tsx          # 路由守卫组件
├── lib/
│   ├── auth/
│   │   └── api.ts              # 认证 API 客户端
│   ├── types.ts                # 类型定义（含认证类型）
│   └── user-store.ts           # 用户状态管理
└── .env.local                  # 环境变量
```

## 环境变量配置

### 后端 (.env)
```bash
# 服务器配置
SERVER_PORT=3001

# 数据库配置
USE_SQLITE=true

# 认证配置
JWT_SECRET=your-secret-key-change-in-production
ENV=development
ACCESS_TOKEN_EXPIRE=30          # Access Token 过期时间（分钟）
REFRESH_TOKEN_EXPIRE=7          # Refresh Token 过期时间（天）
MAX_LOGIN_ATTEMPTS=5            # 最大登录尝试次数
ACCOUNT_LOCK_DURATION=30        # 账户锁定时间（分钟）
```

### 前端 (.env.local)
```bash
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_NAME=BizLens
```

## 快速开始

### 1. 启动后端
```bash
cd backend
go run cmd/main.go
```

后端将在 http://localhost:3001 启动

### 2. 启动前端
```bash
cd frontend
npm install
npm run dev
```

前端将在 http://localhost:3000 启动

### 3. 测试认证流程

1. 访问 http://localhost:3000/auth/register 注册新账号
2. 注册成功后自动跳转到首页
3. 访问 http://localhost:3000/auth/login 登录
4. 登录后 Token 会自动保存到 localStorage
5. 所有受保护的 API 请求会自动注入 Token

## 安全特性

### 1. 密码安全
- 使用 BCrypt 加密存储
- 密码长度至少 6 位
- 不在响应中返回密码相关信息

### 2. Token 安全
- Access Token 有效期 30 分钟
- Refresh Token 有效期 7 天
- 刷新令牌使用后立即吊销
- Token 使用 HS256 算法签名

### 3. 暴力破解防护
- 连续 5 次登录失败锁定账户
- 锁定时间 30 分钟
- 登录成功后重置失败计数

### 4. CORS 配置
- 支持跨域请求
- 允许 Authorization 头
- 支持 OPTIONS 预检请求

## 使用示例

### 在前端组件中使用 AuthGuard

```tsx
import AuthGuard from "@/components/auth-guard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div>
        <h1>仪表板</h1>
        {/* 只有认证用户才能看到的内容 */}
      </div>
    </AuthGuard>
  );
}
```

### 调用受保护的 API

```tsx
import { request } from "@/lib/auth/api";

export async function getDataSources() {
  // Token 会自动注入，无需手动处理
  return request("/api/tenants/my-tenant/data-sources");
}
```

### 检查用户认证状态

```tsx
import { isAuthenticated, getCurrentUser } from "@/lib/user-store";

if (isAuthenticated()) {
  const user = getCurrentUser();
  console.log("当前用户:", user.name);
}
```

## 常见问题

### Q: Token 过期了怎么办？
A: 系统会自动使用 Refresh Token 刷新 Access Token，用户无感知。如果 Refresh Token 也过期了，用户需要重新登录。

### Q: 如何修改 Token 过期时间？
A: 修改后端 `.env` 文件中的 `ACCESS_TOKEN_EXPIRE` 和 `REFRESH_TOKEN_EXPIRE` 配置。

### Q: 如何添加新的受保护路由？
A: 在后端使用 `middleware.Auth(authService)` 包装 Handler，在前端使用 `<AuthGuard>` 包裹组件。

### Q: 如何实现第三方登录？
A: `AuthProvider` 模型已预留，可以实现 Google、GitHub、微信等第三方登录。

## 后续优化

- [ ] 添加邮箱验证
- [ ] 添加双因素认证（2FA）
- [ ] 添加密码重置功能
- [ ] 添加登录历史记录
- [ ] 添加设备管理
- [ ] 实现第三方登录

## 相关文件

- [tasklist.md](../../.monkeycode/specs/user-auth-system/tasklist.md) - 实施任务清单
- [requirements.md](../../.monkeycode/specs/user-auth-system/requirements.md) - 需求文档
- [design.md](../../.monkeycode/specs/user-auth-system/design.md) - 设计文档
