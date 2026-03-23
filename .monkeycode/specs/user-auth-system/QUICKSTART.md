# 用户认证系统 - 快速开始指南

## 概述

本文档提供用户认证系统的快速实施指南。详细设计请参考：
- [需求文档](./requirements.md)
- [技术设计](./design.md)
- [任务清单](./tasklist.md)

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.21 + net/http + GORM |
| 前端 | Next.js 15 + React 19 + TypeScript |
| 认证 | JWT (HS256) |
| 加密 | BCrypt (cost=12) |

## API 端点

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/auth/register | 否 | 用户注册 |
| POST | /api/auth/login | 否 | 用户登录 |
| POST | /api/auth/logout | 否 | 用户登出 |
| POST | /api/auth/refresh | 否 | 刷新 Token |
| GET | /api/auth/me | 是 | 获取当前用户 |
| PUT | /api/auth/me | 是 | 更新用户信息 |

## 快速实施步骤

### 1. 后端实施 (约 4 小时)

```bash
# 1.1 进入后端目录
cd /workspace/backend

# 1.2 安装依赖
go mod tidy

# 1.3 创建必要的文件
mkdir -p internal/dto internal/service
```

#### 文件清单

需要创建/修改的文件：

```
backend/
├── cmd/main.go                    # 修改：添加认证路由
├── internal/
│   ├── model/model.go             # 修改：扩展 User 模型
│   ├── dto/auth_dto.go            # 新建：DTO 定义
│   ├── service/auth_service.go    # 新建：认证服务
│   ├── handler/auth_handler.go    # 新建：认证 Handler
│   └── middleware/auth.go         # 新建：JWT 中间件
└── .env.example                   # 修改：添加 JWT_SECRET
```

### 2. 前端实施 (约 4 小时)

```bash
# 2.1 进入前端目录
cd /workspace/frontend

# 2.2 创建必要的目录
mkdir -p lib/auth app/auth/login app/auth/register
```

#### 文件清单

需要创建/修改的文件：

```
frontend/
├── lib/
│   ├── auth/
│   │   ├── types.ts               # 新建：类型定义
│   │   └── api.ts                 # 新建：API 客户端
│   ├── user-store.ts              # 修改：集成 Token 管理
│   └── api-client.ts              # 新建：统一 API 客户端
├── components/
│   └── auth-guard.tsx             # 新建：路由保护
├── app/
│   ├── auth/
│   │   ├── login/page.tsx         # 新建：登录页面
│   │   └── register/page.tsx      # 新建：注册页面
│   └── layout.tsx                 # 修改：添加 AuthGuard
└── .env.local                     # 确认：API 地址配置
```

### 3. 环境变量配置

```bash
# 后端 .env.local
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
ENV=development

# 前端 .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. 测试验证

```bash
# 启动后端
cd /workspace/backend
go run cmd/main.go

# 启动前端
cd /workspace/frontend
npm run dev
```

访问 http://localhost:3000/auth/login 测试登录流程。

## 请求/响应示例

### 注册请求

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "name": "张三"
}
```

### 注册响应

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com",
      "name": "张三",
      "role": "owner",
      "tenantId": "uuid-here",
      "createdAt": "2026-03-23T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

### 登录请求

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

### 受保护 API 请求

```http
GET /api/auth/me
Authorization: Bearer eyJhbGc...
```

## 常见问题

### Q: Token 过期怎么办？

A: 前端会自动使用 Refresh Token 刷新 Access Token，无需用户重新登录。

### Q: 忘记密码如何实现？

A: 当前版本不支持，后续可通过邮件验证码实现密码重置。

### Q: 如何集成 OAuth 登录？

A: 预留了 AuthProvider 表，后续可添加 Google、GitHub 等 OAuth 提供商。

## 安全提示

1. **生产环境必须修改 JWT_SECRET**：使用至少 32 字符的随机密钥
2. **启用 HTTPS**：所有认证请求必须通过 HTTPS 传输
3. **定期轮换密钥**：建议每季度轮换一次 JWT 密钥
4. **监控异常登录**：记录并告警异常登录行为

## 后续步骤

1. 完成基础认证功能后，考虑添加：
   - 双因素认证 (2FA)
   - 密码重置功能
   - OAuth 第三方登录
   - 会话管理界面

2. 阅读完整文档：
   - [需求文档](./requirements.md) - 详细功能需求
   - [技术设计](./design.md) - 完整技术实现
   - [任务清单](./tasklist.md) - 实施步骤分解

---

**创建时间**: 2026-03-23
**版本**: 1.0
