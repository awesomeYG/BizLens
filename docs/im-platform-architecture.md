# IM 平台集成架构文档

## 概述

BizLens 支持多 IM 平台集成，允许用户通过统一的界面配置和管理不同的即时通讯平台，实现 AI 消息推送、告警通知和自动化报告。

## 支持的平台

### 已实现的平台

| 平台 | 类型 | 认证方式 | 状态 |
|------|------|----------|------|
| 钉钉 | 国内 | Webhook + Secret 签名 | ✅ 已实现 |
| 飞书 | 国内 | Webhook + Secret 签名 | ✅ 已实现 |
| 企业微信 | 国内 | Webhook | ✅ 已实现 |
| Slack | 国际 | Incoming Webhook | ✅ 已实现 |
| Telegram | 国际 | Bot API | ✅ 已实现 |
| Discord | 国际 | Webhook | ✅ 已实现 |

## 架构设计

### 核心设计理念

采用**适配器模式**（Adapter Pattern），将不同 IM 平台的实现细节封装在独立的适配器中，对外提供统一的接口。

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (Next.js)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  Settings   │  │  Send       │  │  History    │  │
│  │  Page       │  │  Page       │  │  List       │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
                            │
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────┐
│                 Backend (Go)                         │
│  ┌─────────────────────────────────────────────┐    │
│  │          IM Service (Business Logic)         │    │
│  └─────────────────────────────────────────────┘    │
│                            │                          │
│  ┌─────────────────────────────────────────────┐    │
│  │         Adapter Interface (统一接口)         │    │
│  │  - Send(msg Message, secret string)         │    │
│  │  - Test(webhookURL, secret string)          │    │
│  └─────────────────────────────────────────────┘    │
│           │           │           │                  │
│  ┌────────┴──┐  ┌────┴─────┐  ┌──┴──────┐          │
│  │ Dingtalk  │  │  Feishu  │  │ Wecom   │ ...      │
│  │ Adapter   │  │  Adapter │  │ Adapter │          │
│  └───────────┘  └──────────┘  └─────────┘          │
└─────────────────────────────────────────────────────┘
```

## 目录结构

```
server/internal/
├── im/                        # IM 平台适配器层
│   ├── adapter.go             # 适配器接口定义
│   ├── dingtalk.go            # 钉钉适配器
│   ├── feishu.go              # 飞书适配器
│   ├── wecom.go               # 企业微信适配器
│   ├── slack.go               # Slack 适配器
│   ├── telegram.go            # Telegram 适配器
│   └── discord.go             # Discord 适配器
├── service/
│   └── im_service.go          # IM 业务逻辑层
├── handler/
│   └── im_handler.go          # HTTP Handler
└── model/
    └── model.go               # 数据模型定义

lib/im/                        # 前端 IM 模块
├── types.ts                   # TypeScript 类型定义
├── registry.ts                # 平台元信息注册表
└── index.ts                   # 导出

components/
├── IMPlatformCard.tsx         # IM 平台卡片组件
├── IMPlatformForm.tsx         # IM 平台表单组件
└── IMPlatformIcon.tsx         # IM 平台图标组件

app/im/
├── settings/
│   └── page.tsx               # IM 配置管理页面
└── notifications/
    └── page.tsx               # 通知发送页面
```

## 扩展新平台指南

### 步骤 1: 后端 - 添加平台常量

在 `server/internal/model/model.go` 中添加平台类型常量：

```go
const (
    // ... 现有常量
    IMPlatformYourPlatform IMPlatformType = "yourplatform"
)
```

### 步骤 2: 后端 - 创建适配器

在 `server/internal/im/` 创建新文件 `yourplatform.go`：

```go
package im

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

// YourPlatformAdapter 你的平台适配器
type YourPlatformAdapter struct{}

func (y *YourPlatformAdapter) Send(webhookURL string, msg Message, secret string) SendResult {
    // 1. 构建消息体（根据平台 API 文档）
    body := YourPlatformBody{
        Content: msg.Content,
        // ... 其他字段
    }
    
    if msg.Title != "" {
        body.Content = fmt.Sprintf("*%s*\n%s", msg.Title, msg.Content)
    }
    
    jsonData, err := json.Marshal(body)
    if err != nil {
        return SendResult{Success: false, Error: fmt.Sprintf("序列化失败：%v", err)}
    }
    
    // 2. 发送 HTTP 请求
    client := &http.Client{Timeout: 10 * time.Second}
    resp, err := client.Post(webhookURL, "application/json", bytes.NewBuffer(jsonData))
    if err != nil {
        return SendResult{Success: false, Error: fmt.Sprintf("请求失败：%v", err)}
    }
    defer resp.Body.Close()
    
    // 3. 处理响应
    if resp.StatusCode != 200 {
        return SendResult{Success: false, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
    }
    
    return SendResult{Success: true}
}

func (y *YourPlatformAdapter) Test(webhookURL, secret string) SendResult {
    return y.Send(webhookURL, Message{
        Title:    "🤖 AI BI 平台连接测试",
        Content:  "如果您收到这条消息，说明配置正确！",
        Markdown: true,
    }, secret)
}
```

### 步骤 3: 后端 - 注册适配器

修改 `server/internal/im/adapter.go`：

```go
func GetAdapter(t model.IMPlatformType) Adapter {
    switch t {
    // ... 现有 case
    case model.IMPlatformYourPlatform:
        return &YourPlatformAdapter{}
    default:
        return nil
    }
}
```

### 步骤 4: 前端 - 添加类型

修改 `lib/im/types.ts`：

```typescript
export type IMPlatformType = 
  | "dingtalk" 
  | "feishu" 
  | "wecom" 
  | "slack" 
  | "telegram" 
  | "discord"
  | "yourplatform";  // 新增
```

### 步骤 5: 前端 - 注册平台元信息

修改 `lib/im/registry.ts`：

```typescript
export const IM_PLATFORM_REGISTRY: Record<string, IMPlatformMeta> = {
  // ... 现有平台
  yourplatform: {
    type: "yourplatform",
    label: "Your Platform",
    description: "通过 Your Platform 发送消息",
    color: "#XXXXXX",  // 品牌色
    iconBg: "bg-indigo-500/20",
    fields: [
      COMMON_WEBHOOK_FIELD,
      // 如需额外字段可继续添加
      // { key: "chatId", label: "Chat ID", placeholder: "...", required: false, type: "text" },
    ],
  },
};
```

### 步骤 6: 前端 - 添加图标

修改 `components/IMPlatformIcon.tsx`，添加平台的 SVG 图标：

```typescript
case "yourplatform":
  return (
    <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" style={iconStyle}>
      {/* SVG path */}
    </svg>
  );
```

### 步骤 7: 测试

1. 启动后端服务
2. 访问 `/im/settings` 页面
3. 添加新平台配置
4. 点击"测试"按钮验证连接
5. 访问 `/im/notifications` 发送测试消息

## API 参考

### IM 配置管理

```
GET    /api/tenants/{id}/im-configs           # 获取 IM 配置列表
POST   /api/tenants/{id}/im-configs           # 创建 IM 配置
PUT    /api/tenants/{id}/im-configs/{id}      # 更新配置
DELETE /api/tenants/{id}/im-configs/{id}      # 删除配置
POST   /api/tenants/{id}/im-configs/{id}/test # 测试连接
```

### 通知发送

```
POST   /api/tenants/{id}/notifications/send   # 发送通知
GET    /api/tenants/{id}/notifications        # 获取通知历史
```

## 配置说明

### 各平台 Webhook 配置

#### 钉钉
- Webhook 格式：`https://oapi.dingtalk.com/robot/send?access_token=TOKEN`
- 签名密钥：可选，推荐使用 HMAC-SHA256 签名

#### 飞书
- Webhook 格式：`https://open.feishu.cn/open-apis/bot/v2/hook/TOKEN`
- 签名密钥：可选，使用 timestamp + secret 签名

#### 企业微信
- Webhook 格式：`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY`
- 无需签名

#### Slack
- Webhook 格式：`https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX`
- 无需签名

#### Telegram
- API URL: `https://api.telegram.org/bot{TOKEN}/sendMessage`
- Chat ID: 在 secret 字段填写

#### Discord
- Webhook 格式：`https://discord.com/api/webhooks/{WEBHOOK_ID}/{TOKEN}`
- 无需签名

## 安全考虑

1. **Webhook URL 加密存储**：敏感信息应该加密存储
2. **签名验证**：支持签名的平台应启用签名增强安全性
3. **访问控制**：确保只有授权用户可以配置 IM 平台
4. **速率限制**：对通知发送进行速率限制，防止滥用

## 最佳实践

1. **统一错误处理**：所有适配器应返回统一的错误格式
2. **超时设置**：HTTP 请求应设置合理的超时时间（建议 10 秒）
3. **日志记录**：记录发送成功/失败的日志，便于排查问题
4. **重试机制**：对于临时性错误，可实现自动重试
5. **健康检查**：定期检测已配置平台的健康状态

## 常见问题

### Q: 为什么我添加的新平台没有显示？
A: 检查是否在 `types.ts` 和 `registry.ts` 中都添加了新平台的配置。

### Q: Webhook 测试失败怎么办？
A: 
1. 检查 Webhook URL 是否正确
2. 检查网络连接
3. 查看后端日志获取详细错误信息
4. 确认平台 API 是否有变更

### Q: 如何调试适配器代码？
A: 在 `Send` 方法中添加日志输出，查看请求和响应的详细内容。

## 更新日志

- **2026-02-04**: 新增 Slack、Telegram、Discord 支持，重构 UI 界面
