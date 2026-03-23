# 认证系统测试指南

本文档提供完整的后端和前端测试流程说明。

## 环境准备

### 1. 数据库要求

**SQLite（推荐用于开发测试）**
- 确保数据库文件目录可写
- 默认路径：`/tmp/ai_bi.db`（已配置为临时文件）

**PostgreSQL（生产环境）**
```bash
# 启动 PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ai_bi \
  -p 5432:5432 \
  postgres:15

# 或本地安装
sudo service postgresql start
```

### 2. 环境变量配置

**后端 (.env 或使用默认值)**
```bash
cd /workspace/backend

# SQLite 模式（推荐测试用）
export USE_SQLITE=true

# PostgreSQL 模式
export USE_SQLITE=false
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=ai_bi

# JWT 配置
export JWT_SECRET="your-secret-key-change-in-production"
export ACCESS_TOKEN_EXPIRE=30
export REFRESH_TOKEN_EXPIRE=7
```

**前端 (.env.local)**
```bash
cd /workspace/frontend
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_NAME=BizLens
EOF
```

## 后端测试

### 1. 启动后端服务

```bash
cd /workspace/backend

# 清理旧数据库（如果需要）
rm -f /tmp/ai_bi.db

# 方式 1: 直接运行（开发模式）
go run cmd/main.go

# 方式 2: 编译后运行
go build -o ai-bi-server ./cmd/main.go
./ai-bi-server

# 方式 3: 后台运行
nohup go run cmd/main.go > backend.log 2>&1 &
```

### 2. 验证后端启动成功

```bash
# 健康检查
curl -s http://localhost:3001/api/health

# 预期输出：
# {"status":"ok"}
```

### 3. API 测试 - 完整认证流程

#### 3.1 用户注册

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo-tenant",
    "name": "测试用户",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**成功响应：**
```json
{
  "user": {
    "id": "uuid-string",
    "tenantId": "demo-tenant",
    "name": "测试用户",
    "email": "test@example.com",
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

#### 3.2 用户登录

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### 3.3 获取当前用户信息（需要认证）

```bash
# 保存登录响应中的 accessToken
ACCESS_TOKEN="eyJhbGc..."

curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**成功响应：**
```json
{
  "id": "uuid",
  "tenantId": "demo-tenant",
  "name": "测试用户",
  "email": "test@example.com",
  "role": "member",
  "lastLoginAt": "2026-03-23T10:00:00Z",
  "createdAt": "2026-03-23T10:00:00Z"
}
```

#### 3.4 测试未认证请求

```bash
curl -X GET http://localhost:3001/api/auth/me
```

**预期响应：**
```json
{"error":"未提供认证令牌"}
```

#### 3.5 刷新 Token

```bash
curl -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

#### 3.6 修改密码

```bash
curl -X POST http://localhost:3001/api/auth/change-password \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "password123",
    "newPassword": "newpassword456"
  }'
```

#### 3.7 用户登出

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

### 4. 错误场景测试

#### 4.1 重复注册

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "demo",
    "name": "重复用户",
    "email": "test@example.com",
    "password": "password123"
  }'
# 预期：{"error":"邮箱已被注册"}
```

#### 4.2 错误密码

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }'
# 预期：{"error":"密码错误"}
```

#### 4.3 无效 Token

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer invalid-token"
# 预期：{"error":"令牌无效"}
```

## 前端测试

### 1. 安装依赖

```bash
cd /workspace/frontend
npm install
```

### 2. 启动前端开发服务器

```bash
# 确保后端已启动在 http://localhost:3001

# 启动前端
npm run dev

# 前端将在 http://localhost:3000 启动
```

### 3. 前端页面测试

#### 3.1 访问注册页面
- 打开浏览器访问：http://localhost:3000/auth/register
- 填写注册表单：
  - 租户 ID: `demo`
  - 姓名：`测试用户`
  - 邮箱：`test@example.com`
  - 密码：`password123`
  - 确认密码：`password123`
- 点击注册按钮

#### 3.2 访问登录页面
- 打开浏览器访问：http://localhost:3000/auth/login
- 填写登录表单：
  - 邮箱：`test@example.com`
  - 密码：`password123`
- 点击登录按钮

#### 3.3 验证 Token 存储
```javascript
// 在浏览器控制台执行
console.log("Access Token:", localStorage.getItem("auth_access_token"));
console.log("Refresh Token:", localStorage.getItem("auth_refresh_token"));
```

#### 3.4 测试受保护路由

```tsx
// 在需要认证的页面使用 AuthGuard
import AuthGuard from "@/components/auth-guard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div>
        <h1>仪表板内容</h1>
      </div>
    </AuthGuard>
  );
}
```

### 4. 前端功能测试

#### 4.1 测试登录流程

```tsx
import { loginUser } from "@/lib/user-store";

// 在组件中调用
const user = await loginUser("test@example.com", "password123");
console.log("登录成功:", user);
```

#### 4.2 测试认证状态

```tsx
import { isAuthenticated, getCurrentUser } from "@/lib/user-store";

if (isAuthenticated()) {
  const user = getCurrentUser();
  console.log("当前用户:", user.name);
}
```

#### 4.3 测试 API 调用

```tsx
import { request } from "@/lib/auth/api";

// 自动注入 Token
const data = await request("/api/tenants/demo/data-sources");
console.log("数据源列表:", data);
```

## 一键测试脚本

### 后端测试脚本

```bash
#!/bin/bash
# test-backend.sh

API_URL="http://localhost:3001"

echo "=== 认证系统后端测试 ==="

# 1. 健康检查
echo -e "\n1. 健康检查"
curl -s $API_URL/api/health

# 2. 注册
echo -e "\n\n2. 用户注册"
RESP=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"test","name":"测试","email":"test@test.com","password":"pass123"}')
echo "$RESP"

# 3. 登录
echo -e "\n\n3. 用户登录"
RESP=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}')
echo "$RESP"

# 提取 Token
TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo -e "\n\nAccess Token: ${TOKEN:0:50}..."

# 4. 获取用户
echo -e "\n\n4. 获取当前用户"
curl -s -X GET $API_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 5. 未认证访问
echo -e "\n\n5. 未认证访问"
curl -s -X GET $API_URL/api/auth/me

echo -e "\n\n=== 测试完成 ==="
```

使用方法：
```bash
chmod +x test-backend.sh
./test-backend.sh
```

### 前端测试脚本

```bash
#!/bin/bash
# test-frontend.sh

cd /workspace/frontend

# 1. 检查 TypeScript 编译
echo "=== TypeScript 编译检查 ==="
npx tsc --noEmit

# 2. 检查 ESLint
echo -e "\n=== ESLint 检查 ==="
npm run lint

# 3. 运行测试（如果有）
echo -e "\n=== 运行单元测试 ==="
npm test 2>/dev/null || echo "未配置测试"

echo -e "\n=== 前端检查完成 ==="
```

## 常见问题排查

### 1. 数据库权限错误

**问题：** `attempt to write a readonly database`

**解决：**
```bash
# 使用 /tmp 目录
rm -f /tmp/ai_bi.db

# 或者修改目录权限
chmod 777 /workspace/server
```

### 2. 端口被占用

**问题：** `bind: address already in use`

**解决：**
```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>

# 或者使用不同端口
export SERVER_PORT=3002
```

### 3. Token 刷新失败

**问题：** 刷新令牌无效或已过期

**解决：**
- Access Token 默认 30 分钟过期
- Refresh Token 默认 7 天过期
- 过期后需要重新登录

### 4. CORS 错误

**问题：** 前端无法访问后端 API

**解决：**
- 确保 Next.js 配置了代理（已配置）
- 或者在浏览器使用 http://localhost:3000 访问前端

## 性能测试

### 使用 Apache Bench 测试

```bash
# 安装 Apache Bench
sudo apt-get install apache2-utils

# 测试登录接口（100 个请求，10 个并发）
ab -n 100 -c 10 \
  -H "Content-Type: application/json" \
  -p login.json \
  http://localhost:3001/api/auth/login
```

login.json 内容：
```json
{"email":"test@example.com","password":"password123"}
```

## 安全测试建议

1. **密码策略测试**
   - 测试弱密码拒绝
   - 测试密码长度限制

2. **暴力破解防护**
   - 连续 5 次登录失败后账户锁定
   - 锁定时间 30 分钟

3. **Token 安全**
   - 验证 Token 过期时间
   - 测试 Token 刷新机制
   - 验证吊销的 Token 无法使用

4. **SQL 注入防护**
   - 测试特殊字符输入
   - 验证参数绑定正确

## 下一步

完成测试后，你可以：

1. 根据业务需求调整 Token 过期时间
2. 实现第三方登录（Google, GitHub 等）
3. 添加邮箱验证功能
4. 实现双因素认证（2FA）
5. 添加登录历史记录
6. 实现设备管理功能

## 相关文件

- [后端实现](../../../backend/internal/service/auth_service.go)
- [前端 API](../../../frontend/lib/auth/api.ts)
- [认证守卫](../../../frontend/components/auth-guard.tsx)
- [API 文档](./auth-system-implementation.md)
