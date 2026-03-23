# 用户认证系统需求文档

## 文档信息

- **版本**: 1.0
- **日期**: 2026-03-23
- **状态**: Draft
- **作者**: AI Assistant

## 1. 引言

### 1.1 目的

本文档定义 AI-BI 项目的用户认证系统需求，包括用户注册、登录、Token 管理、会话管理等核心功能。

### 1.2 范围

本认证系统覆盖：
- 后端 Go 服务的认证 API
- 前端 Next.js 应用的认证 UI
- JWT Token 认证机制
- 多租户用户管理

### 1.3 术语定义

| 术语 | 定义 |
|------|------|
| JWT | JSON Web Token，用于无状态认证的令牌格式 |
| Access Token | 访问令牌，用于 API 请求认证，短期有效 |
| Refresh Token | 刷新令牌，用于获取新的 Access Token，长期有效 |
| Tenant | 租户，SaaS 多租户架构中的独立组织单元 |
| BCrypt | 密码哈希算法，用于安全存储用户密码 |

## 2. 总体描述

### 2.1 用户特征

| 用户类型 | 描述 |
|----------|------|
| 普通用户 | 具有基本访问权限，可查看仪表盘、创建报表 |
| 管理员 | 具有管理权限，可管理数据源、IM 配置、告警规则等 |
| 所有者 | 租户的创建者，具有最高权限，可管理成员 |

### 2.2 假设与依赖

1. 后端使用 Go 标准库 net/http + GORM
2. 前端使用 Next.js 15 + React 19 + TypeScript
3. 数据库支持 PostgreSQL/MySQL/SQLite
4. 生产环境使用 HTTPS

## 3. 功能需求

### 3.1 用户注册

#### FR-AUTH-001: 邮箱密码注册

**描述**: 用户可通过邮箱和密码注册新账户

**输入**:
- 邮箱地址（必需）
- 密码（必需）
- 用户名/昵称（可选）
- 租户 ID（可选，不填则创建新租户）

**处理**:
1. 验证邮箱格式
2. 验证密码强度
3. 检查邮箱是否已存在
4. 对密码进行 BCrypt 加密
5. 创建用户记录
6. 如未提供租户 ID，创建新租户并关联

**输出**:
- 成功：返回用户信息和 Access Token
- 失败：返回错误信息

**优先级**: 高

---

#### FR-AUTH-002: 密码强度校验

**描述**: 注册时校验密码强度

**输入**: 用户输入的密码

**处理**:
1. 检查密码长度 >= 8 字符
2. 检查包含大写字母
3. 检查包含小写字母
4. 检查包含数字
5. 检查包含特殊字符

**输出**:
- 通过：继续注册流程
- 失败：返回具体未满足的规则

**优先级**: 高

---

### 3.2 用户登录

#### FR-AUTH-010: 账号密码登录

**描述**: 用户可通过邮箱和密码登录

**输入**:
- 邮箱地址
- 密码

**处理**:
1. 根据邮箱查找用户
2. 验证密码哈希
3. 生成 JWT Access Token 和 Refresh Token
4. 更新最后登录时间
5. 记录登录日志

**输出**:
- 成功：返回用户信息和 Token 对
- 失败：返回错误信息（不泄露具体原因）

**优先级**: 高

---

#### FR-AUTH-011: 防止暴力破解

**描述**: 限制登录尝试频率

**输入**: 登录请求

**处理**:
1. 记录每个 IP/邮箱的失败尝试次数
2. 5 次失败后锁定 15 分钟
3. 锁定期间拒绝该邮箱/IP 的登录请求

**输出**:
- 正常：继续登录流程
- 锁定：返回"尝试次数过多，请稍后再试"

**优先级**: 高

---

### 3.3 Token 管理

#### FR-AUTH-020: 刷新 Access Token

**描述**: 使用 Refresh Token 获取新的 Access Token

**输入**:
- Refresh Token

**处理**:
1. 验证 Refresh Token 签名
2. 检查是否过期
3. 检查是否被吊销
4. 生成新的 Access Token（可选：轮换 Refresh Token）

**输出**:
- 成功：返回新的 Access Token
- 失败：返回错误信息

**优先级**: 高

---

#### FR-AUTH-021: Token 过期策略

**描述**: 定义 Token 的有效期

**规则**:
1. Access Token 有效期：15 分钟
2. Refresh Token 有效期：7 天
3. Refresh Token 可配置为一次性使用（轮换模式）

**优先级**: 高

---

### 3.4 用户登出

#### FR-AUTH-030: 用户登出

**描述**: 用户主动登出系统

**输入**:
- Access Token（用于识别用户）
- Refresh Token（用于吊销）

**处理**:
1. 将 Refresh Token 加入黑名单
2. 清除客户端存储的 Token

**输出**:
- 成功：返回登出确认

**优先级**: 中

---

### 3.5 用户信息管理

#### FR-AUTH-040: 获取当前用户信息

**描述**: 获取已登录用户的详细信息

**输入**:
- Access Token（通过 Authorization header）

**处理**:
1. 验证 Access Token
2. 从 Token 中提取用户 ID
3. 查询用户完整信息（排除密码）

**输出**:
- 成功：返回用户信息
- 失败：返回 401

**优先级**: 高

---

#### FR-AUTH-041: 更新用户信息

**描述**: 更新用户基本信息

**输入**:
- Access Token
- 可更新字段（用户名、头像等）

**处理**:
1. 验证 Access Token
2. 验证输入数据
3. 更新用户记录

**输出**:
- 成功：返回更新后的用户信息
- 失败：返回错误信息

**优先级**: 中

---

### 3.6 OAuth 扩展

#### FR-AUTH-050: OAuth 回调接口

**描述**: 支持第三方 OAuth 登录回调（未来扩展）

**输入**:
- OAuth Provider 返回的授权码
- State 参数

**处理**:
1. 验证 State 参数
2. 使用授权码换取 Access Token
3. 获取用户信息
4. 创建或关联本地用户
5. 生成本地 JWT Token

**输出**:
- 成功：重定向到前端并携带 Token
- 失败：重定向到错误页面

**优先级**: 低（未来功能）

---

## 4. 非功能需求

### 4.1 安全性

#### NFR-AUTH-001: 密码加密

**描述**: 所有用户密码必须加密存储

**要求**:
- 使用 BCrypt 算法
- Cost factor >= 12

---

#### NFR-AUTH-002: HTTPS 要求

**描述**: 所有认证相关 API 必须通过 HTTPS 传输

**要求**:
- 生产环境强制 HTTPS
- Cookie 设置 Secure 标志

---

#### NFR-AUTH-003: CORS 配置

**描述**: 配置跨域请求策略

**要求**:
- 仅允许受信任的域名
- 支持 credentials
- 预检请求缓存

---

### 4.2 性能

#### NFR-AUTH-010: 响应时间

**要求**:
- 登录接口 P95 < 500ms
- Token 刷新接口 P95 < 100ms
- 用户信息接口 P95 < 100ms

---

### 4.3 可用性

#### NFR-AUTH-020: 错误处理

**要求**:
- 统一的错误响应格式
- 不泄露敏感信息
- 详细的日志记录（服务端）

---

## 5. 数据模型需求

### 5.1 User 模型扩展

**现有字段**:
- ID, TenantID, Name, Email, Role, CreatedAt, UpdatedAt, DeletedAt

**新增字段**:
- PasswordHash: 密码哈希
- LastLoginAt: 最后登录时间
- LoginAttempts: 连续失败次数
- LockedUntil: 锁定截止时间

### 5.2 新增表

#### RefreshTokens 表
- ID
- UserID
- Token: 刷新令牌哈希
- ExpiresAt: 过期时间
- RevokedAt: 吊销时间
- CreatedAt
- UserAgent: 客户端信息
- IPAddress: 登录 IP

#### AuthProviders 表（未来扩展）
- ID
- UserID
- Provider: google/github 等
- ProviderUserID: 第三方用户 ID
- AccessToken: OAuth 访问令牌
- RefreshToken: OAuth 刷新令牌
- ExpiresAt
- CreatedAt
- UpdatedAt

---

## 6. 接口需求

### 6.1 API 路径规范

所有认证 API 遵循以下路径规范：
```
/api/auth/{action}
```

### 6.2 请求/响应格式

**请求头**:
```
Content-Type: application/json
Authorization: Bearer {access_token}
```

**响应格式**:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

或错误时：
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误信息"
  }
}
```

---

## 7. 验收标准

1. 用户可成功注册并登录
2. 密码强度校验正常工作
3. Token 可正常刷新
4. 登出后 Token 失效
5. 未认证请求被拒绝
6. 暴力破解被阻止
7. 所有 API 响应符合格式规范
