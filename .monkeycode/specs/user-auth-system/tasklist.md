# 用户认证系统实施任务清单

## 阶段 1: 后端基础 (优先级：高)

### 1.1 数据模型
- [ ] 扩展 `backend/internal/model/model.go` 中的 User 模型
  - 添加 PasswordHash 字段
  - 添加 LastLoginAt 字段
  - 添加 LoginAttempts 字段
  - 添加 LockedUntil 字段
- [ ] 创建 RefreshToken 模型
- [ ] 创建 AuthProvider 模型（预留）
- [ ] 更新 AutoMigrate 函数

### 1.2 依赖安装
- [ ] 添加 JWT 库：`gopkg.in/square/go-jose.v2/jwt`
- [ ] 添加 BCrypt 库：`golang.org/x/crypto/bcrypt` (已存在)
- [ ] 运行 `go mod tidy`

### 1.3 服务层实现
- [ ] 创建 `backend/internal/service/auth_service.go`
  - Register 方法
  - Login 方法
  - Logout 方法
  - RefreshToken 方法
  - GetUserByID 方法
  - UpdateUser 方法
  - 辅助方法（Token 生成、密码验证等）

### 1.4 Handler 层实现
- [ ] 创建 `backend/internal/handler/auth_handler.go`
  - Register 处理函数
  - Login 处理函数
  - Logout 处理函数
  - RefreshToken 处理函数
  - GetCurrentUser 处理函数
  - UpdateUser 处理函数

### 1.5 DTO 定义
- [ ] 创建 `backend/internal/dto/auth_dto.go`
  - 请求 DTO
  - 响应 DTO
  - 错误 DTO

### 1.6 中间件实现
- [ ] 创建 `backend/internal/middleware/auth.go`
  - JWT 验证中间件
- [ ] 更新 `backend/internal/middleware/cors.go`
  - 添加认证相关的 CORS 配置

### 1.7 路由注册
- [ ] 更新 `backend/cmd/main.go`
  - 初始化 AuthService
  - 初始化 AuthHandler
  - 注册认证路由
  - 应用 Auth 中间件

### 1.8 环境变量
- [ ] 更新 `backend/.env.example`
  - 添加 JWT_SECRET
  - 添加 ENV 配置

## 阶段 2: 前端实现 (优先级：高)

### 2.1 类型定义
- [ ] 创建 `frontend/lib/auth/types.ts`
  - User 类型
  - Tokens 类型
  - 请求/响应类型

### 2.2 API 客户端
- [ ] 创建 `frontend/lib/auth/api.ts`
  - Token 存储函数
  - request 函数
  - requestWithRetry 函数
  - 注册/登录/登出 API
  - 获取用户 API

### 2.3 更新 user-store
- [ ] 更新 `frontend/lib/user-store.ts`
  - 集成 Token 管理
  - 更新 loginUser 函数
  - 添加 isAuthenticated 函数

### 2.4 创建认证页面
- [ ] 创建 `frontend/app/auth/login/page.tsx`
  - 登录表单
  - 错误处理
  - 密码强度指示器
- [ ] 创建 `frontend/app/auth/register/page.tsx`
  - 注册表单
  - 密码强度验证
  - 错误处理

### 2.5 API 客户端封装
- [ ] 创建 `frontend/lib/api-client.ts`
  - 统一的 API 调用方法
  - 自动 Token 注入

### 2.6 路由保护
- [ ] 创建 `frontend/components/auth-guard.tsx`
  - 认证检查
  - 重定向逻辑

### 2.7 环境变量
- [ ] 更新 `frontend/.env.local`
  - 添加 NEXT_PUBLIC_API_URL

## 阶段 3: 测试与验证 (优先级：中)

### 3.1 后端测试
- [ ] 测试注册接口
- [ ] 测试登录接口
- [ ] 测试 Token 刷新
- [ ] 测试受保护接口
- [ ] 测试暴力破解防护

### 3.2 前端测试
- [ ] 测试登录流程
- [ ] 测试注册流程
- [ ] 测试 Token 自动刷新
- [ ] 测试路由保护
- [ ] 测试登出功能

### 3.3 集成测试
- [ ] 完整认证流程 E2E 测试
- [ ] 跨域请求测试
- [ ] 错误场景测试

## 阶段 4: 优化与文档 (优先级：低)

### 4.1 性能优化
- [ ] Token 缓存优化
- [ ] 数据库索引优化
- [ ] API 响应时间优化

### 4.2 安全加固
- [ ] 审查密码策略
- [ ] 配置速率限制
- [ ] 添加审计日志

### 4.3 文档更新
- [ ] 更新 README.md
- [ ] 添加 API 文档
- [ ] 编写部署指南

---

## 实施顺序建议

1. **第一天**: 完成后端阶段 1 (数据模型、服务、Handler、中间件)
2. **第二天**: 完成前端阶段 2 (类型、API 客户端、页面)
3. **第三天**: 完成测试阶段 3，修复问题
4. **第四天**: 完成优化阶段 4，准备上线

## 验收标准

- [ ] 用户可以成功注册
- [ ] 用户可以成功登录
- [ ] Token 可以正常刷新
- [ ] 未认证请求被正确拒绝
- [ ] 密码强度校验有效
- [ ] 暴力破解被阻止
- [ ] 前端路由保护正常工作
- [ ] 所有 API 响应格式统一
