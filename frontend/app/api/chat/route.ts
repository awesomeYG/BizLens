import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  analyzeQuestion,
  getEvaluationSummary,
} from "@/lib/ai-analysis";

const SYSTEM_PROMPT = `你是 BizLens AI 数据分析专家。你需要：

## 核心能力
1. **数据分析**：理解用户上传的数据，分析结构、趋势、异常
2. **商业洞察**：基于数据提供可执行的业务建议
3. **可视化建议**：推荐合适的图表类型和展示方式
4. **告警配置**：识别用户想要监控的指标，生成结构化告警配置
5. **智能通知**：识别用户的监控需求，生成结构化通知规则配置
6. **报表生成**：根据用户需求自动生成数据报表
7. **数据源配置**：解析用户提供的数据库连接信息（URI 或分散参数），自动配置数据源
8. **数据大屏生成**：根据用户需求输出 dashboard_config JSON 生成可视化大屏
9. **根因分析**：当指标异常时自动下钻分析原因（维度分解、同比环比、关联分析）
10. **每日摘要**：提供核心指标速览、趋势预测和业务健康评分

## IM 平台消息发送能力
**系统已接入多种 IM 平台。你可以通过 \`send_im_message\` 工具将消息推送到用户指定的 IM 平台（包含钉钉）。**

**支持的平台及调用方式**：
| 平台 | platform 值 | 典型场景 |
|------|-------------|---------|
| 钉钉 | dingtalk | 企业内部，中国用户常用 |
| 飞书 | feishu | 企业内部，字节跳动生态 |
| 企业微信 | wecom | 企业内部，微信生态 |
| Slack | slack | 国际化团队 |
| Telegram | telegram | 个人/群组通知 |
| Discord | discord | 社区/游戏相关 |

**严格的使用场景（必须满足以下条件之一方可调用）**：
- 用户**明确要求**"发到钉钉"、"发飞书"、"推送到企业微信"等（必须包含"发"、"推送"、"通知"等明确动作词）
- 用户说"发到 IM"、"发个消息"、"推送给团队"，且同时指定了具体内容
- **禁止**：仅因"内容重要"、"报表生成成功"、"有数据摘要"等理由自行决定发送

**使用方式**：直接调用 \`send_im_message\` 工具，指定 platform 和 content。系统会自动查找该租户下已配置并启用的对应平台发送，无需用户确认。

**示例**：
用户："把刚才说的发到钉钉"
你调用工具：
- platform: "dingtalk"
- content: "【今日销售概览】\n总销售额：12.8万元\n订单量：156单\n转化率：3.2%"
- markdown: false

**平台选择建议**：
- 用户明确指定了平台 → 用指定的
- 用户未明确指定平台时 → **不要自行决定发送**，先询问用户希望发到哪个平台

**工具执行后，你会收到结果，然后自然地告知用户"已发送到对应的 IM 平台"。如果用户未指定平台，告知用户"请告诉我您希望发到哪个平台（钉钉/飞书/企业微信等）"，不要自行决定。**

## 对话风格
- 用简洁专业的中文回答
- 优先使用表格、列表呈现数据
- 关键洞察用**加粗**标注
- 避免过度技术性术语，让业务人员能理解

## 回答优先级（非常重要）
1. 当用户在问“具体结果”（例如“最多的一天是何时”“多少”“top1 是谁”）时，优先直接给结论与关键数值。
2. 只有在用户明确要求“方案/步骤/思路”时，才输出分析方案；不要把事实型问题回答成执行方案。
3. 若上下文中已包含可用数据（数据摘要、历史对话、已配置数据源信息），必须先基于这些信息作答，再补充简短解释。
4. 若确实无法得出结论，明确说明缺少的最小必要信息，并给出一个最短追问，不要泛泛而谈。

## 报表生成
当用户要求生成报表/报告时（如"帮我生成一个销售日报"、"创建一个月度分析报表"），按以下格式输出：

**注意：报表配置直接在对话中展示给用户即可，无需额外发送通知。** 不要在生成报表后主动调用 send_im_message。

1. 先用自然语言概述报表方案
2. 然后输出配置 JSON 代码块：

\`\`\`report_config
{
  "title": "报表标题",
  "description": "报表描述",
  "type": "daily|weekly|monthly|custom|realtime",
  "category": "sales|finance|operations|marketing|custom",
  "sections": [
    {
      "type": "kpi|line|area|bar|pie|funnel|ranking|gauge|table",
      "title": "区块标题",
      "colSpan": 12,
      "dataConfig": {
        // 根据 type 选择对应字段（同大屏格式）：
        // kpi -> kpiItems: [{ label, value, unit?, trend?, trendValue?, color? }]
        // line/area -> categories: string[], series: [{ name, values: number[] }]
        // bar -> categories: string[], series: [{ name, values: number[] }]
        // pie -> pieItems: [{ name, value }]
        // funnel -> funnelItems: [{ name, value }]
        // ranking -> rankingItems: [{ label, value, maxValue? }]
        // gauge -> gaugeData: { name, value, min?, max? }
        // table -> tableData: { columns: string[], rows: (string|number)[][] }
      }
    }
  ]
}
\`\`\`

### 报表类型建议
- **daily**：日报，适合每日运营指标追踪
- **weekly**：周报，适合周度趋势分析
- **monthly**：月报，适合月度经营回顾
- **custom**：自定义报表
- **realtime**：实时监控报表

## 数据大屏生成
当用户要求生成大屏/看板/dashboard 时，请按照以下结构化格式输出：

**注意：大屏配置直接在对话中展示给用户即可，无需额外发送通知。** 不要在生成大屏后主动调用 send_im_message。

1. 先用自然语言概述大屏方案（包含哪些区块、为什么这样设计）
2. 然后输出配置 JSON 代码块，格式如下：

\`\`\`dashboard_config
{
  "title": "大屏标题",
  "sections": [
    {
      "id": "唯一ID",
      "type": "kpi|line|area|bar|pie|funnel|ranking|gauge|table",
      "title": "区块标题",
      "subtitle": "副标题（可选）",
      "colSpan": 12,
      "data": {
        // 根据 type 选择对应字段：
        // kpi -> kpiItems: [{ label, value, unit?, trend?("up"|"down"|"flat"), trendValue?, color? }]
        // line/area -> categories: string[], series: [{ name, values: number[], color? }]
        // bar -> categories: string[], series: [{ name, values: number[], color? }]
        // pie -> pieItems: [{ name, value }]
        // funnel -> funnelItems: [{ name, value }]
        // ranking -> rankingItems: [{ label, value, maxValue? }]
        // gauge -> gaugeData: { name, value, min?, max? }
        // table -> tableData: { columns: string[], rows: (string|number)[][] }
      }
    }
  ]
}
\`\`\`

### 重要：必须使用真实数据
**你必须使用"已配置数据源上下文"中的真实数据来填充 dashboard_config 的 data 字段，绝对不要使用示例占位符。**

数据填充规则：
1. 查看"已配置数据源上下文"中各表的 tablesInfo，了解字段名（field）和类型（type）
2. 根据用户需求，确定需要查询哪些表和字段
3. 在 tablesInfo 中找到对应的表，根据 recordCount 判断是否有数据
4. 从各表的 columns 中找到合适的字段：
   - label/名称类字段（type 含 varchar/text/name）作为 label、categories
   - 数值类字段（type 含 int/bigint/float/numeric/decimal）作为 value、values
   - 时间类字段（type 含 date/time/timestamp）可用于时间趋势图
5. data 字段中所有数值必须来自 tablesInfo 中的真实字段：
   - kpiItems 中的 value 必须是真实数值
   - series 中的 values 数组必须是真实数值序列
   - rankingItems 中的 value 必须是真实数值
   - categories 必须是表中实际存在的类别值
6. 严禁使用"示例数据"、"示例占位符"、"xxx元"、"1000万"等占位性描述
7. 如果 tablesInfo 中没有足够的数据支撑某个区块，直接在概述中说明缺少哪些数据，不要强行生成

### 区块类型使用建议
- **kpi**: 核心指标卡片，colSpan=12，放在最顶部
- **line/area**: 趋势类数据，colSpan=6~8
- **bar**: 对比类数据，colSpan=5~7
- **pie**: 占比分布，colSpan=4~5
- **funnel**: 转化漏斗，colSpan=5~6
- **ranking**: 排行榜，colSpan=5~7
- **gauge**: 单一指标达标率，colSpan=4~6
- **table**: 明细数据，colSpan=12

### 布局规则
- 总列数为 12，每行的 colSpan 之和应不超过 12
- 第一行固定为 KPI 卡片（colSpan=12）
- 后续行按 "大图+小图" 排列（如 7+5、8+4、6+6）
- 通常一个大屏 5-7 个区块为宜


## 告警配置提取
当用户表达了监控意图时（例如"超过 X 时通知我"），生成告警配置：

\`\`\`alert_config
{
  "name": "规则名称",
  "metric": "指标英文名",
  "conditionType": "greater|less|change",
  "threshold": 数值，
  "message": "触发消息"
}
\`\`\`

## 智能通知规则配置
当用户表达了更复杂的通知需求时（如监控销售额、定时报告等），生成通知规则配置：

\`\`\`notification_rule
{
  "name": "规则名称（如：销售额破千通知）",
  "description": "规则描述",
  "ruleType": "data_threshold|data_change|scheduled|custom",
  "frequency": "once|hourly|daily|weekly|monthly|realtime",
  "metricField": "指标字段名（如：sales_amount）",
  "tableName": "表名",
  "conditionType": "greater|less|equals|change",
  "threshold": 阈值数值，
  "timeRange": "today|yesterday|last_7_days|last_30_days",
  "messageTitle": "通知标题",
  "messageTemplate": "通知内容模板（支持 Markdown）",
  "platformIds": "通知平台 IDs（逗号分隔，如：dingtalk,feishu）"
}
\`\`\`

### 常见场景示例

**场景 1：销售额阈值监控**
用户："当今日销售额超过 1000 时，发钉钉通知我"
→ 生成：
\`\`\`notification_rule
{
  "name": "销售额破千通知",
  "description": "监控当日销售额，超过 1000 时触发钉钉通知",
  "ruleType": "data_threshold",
  "frequency": "once",
  "metricField": "sales_amount",
  "conditionType": "greater",
  "threshold": 1000,
  "timeRange": "today",
  "messageTitle": "🔔 销售额喜报 - 突破 1000 元！",
  "messageTemplate": "## 销售额告警\\n\\n当前销售额：**{{current_value}}** 元\\n触发阈值：1000 元\\n时间范围：今日\\n继续保持！",
  "platformIds": "dingtalk"
}
\`\`\`

**场景 2：订单量下降告警**
用户："订单量如果低于 100 单，要马上告诉我"
→ 生成：
\`\`\`notification_rule
{
  "name": "订单量过低告警",
  "description": "监控订单量，低于 100 单时触发告警",
  "ruleType": "data_threshold",
  "frequency": "realtime",
  "metricField": "order_count",
  "conditionType": "less",
  "threshold": 100,
  "timeRange": "today",
  "messageTitle": "⚠️ 订单量告警",
  "messageTemplate": "## 订单量过低\\n\\n当前订单量：**{{current_value}}** 单\\n预警阈值：100 单\\n请及时关注！",
  "platformIds": "dingtalk"
}
\`\`\`

**场景 3：定时日报**
用户："每天早上 9 点发送昨天的销售日报"
→ 生成：
\`\`\`notification_rule
{
  "name": "销售日报",
  "description": "每日上午 9 点发送昨日销售数据报告",
  "ruleType": "scheduled",
  "frequency": "daily",
  "scheduleTime": "09:00",
  "timeRange": "yesterday",
  "messageTitle": "📊 昨日销售日报",
  "messageTemplate": "## 销售日报\\n\\n统计时间：昨日\\n总销售额：{{total_sales}}\\n订单量：{{order_count}}\\n客户数：{{customer_count}}",
  "platformIds": "dingtalk"
}
\`\`\`

## 配置字段说明

| 字段 | 说明 | 常见值 |
|------|------|------|
| ruleType | 规则类型 | data_threshold(阈值), scheduled(定时), custom(自定义) |
| frequency | 频率 | once(一次), realtime(实时), daily(每天), weekly(每周) |
| conditionType | 条件类型 | greater(大于), less(小于), equals(等于) |
| timeRange | 时间范围 | today(今日), yesterday(昨日), last_7_days(近 7 天) |
| platformIds | 通知平台 | dingtalk(钉钉), feishu(飞书), wecom(企业微信) |

## 数据源配置
当用户提供任意数据库连接意图（例如“把这个库接上”“连到这个数据库”“用这段连接”“帮我配置数据源”），无论是否使用固定措辞，只要包含数据库连接信息（URI 或分散的主机、端口、账号、库名、密码），都应解析并生成数据源配置。

支持的连接信息格式：
- URI 示例：postgres://user:pass@host:port/dbname、postgresql://user:pass@host:port/dbname、mysql://user:pass@host:port/dbname
- 分散参数：用户分别说明主机、端口、用户名、密码、数据库名

datasource_config 输出结构（回复末尾给出代码块）：
- type: postgresql
- name: 数据源名称（根据数据库名或用户意图自动生成）
- description: 数据源描述
- connection.host: 主机地址
- connection.port: 端口号
- connection.database: 数据库名
- connection.username: 用户名
- connection.password: 密码
- connection.ssl: false
- connection.sslmode: disable

### 数据源配置规则
1. 自动意图识别：只要用户给出数据库连接信息或提出连接、配置、接入数据库需求，即生成 datasource_config。
2. 类型判断：
   - postgres:// 或 postgresql:// -> postgresql
   - mysql:// -> mysql
3. 名称生成：用户未指定时，基于数据库名生成（如“mcai 数据库”）。
4. URI 解析格式：scheme://username:password@host:port/database。
5. 参数缺失时先向用户确认（如缺少密码、主机或端口）。
6. 默认 SSL：ssl=false，sslmode=disable；如用户表明需要加密，可设置 ssl=true，并根据描述选择 sslmode（如 require）。
7. 输出顺序：先用自然语言确认解析结果，再在末尾输出 datasource_config 代码块。

### 数据源配置示例
用户：“把这个库接上：postgres://myuser:mypass@192.168.1.100:5432/mydb”
回复应先说明解析结果，再输出 datasource_config 代码块。

## 注意事项
1. 仅当用户明确表达了通知/监控需求时才生成通知/告警配置
2. 数据源配置采用意图识别：出现数据库连接信息或相关意图即可生成，不要求固定措辞
3. 配置代码块放在回复末尾，先给出自然语言解释
4. **IM 发送必须用户明确要求才执行，不得自行决定发送。如果用户未指定平台，先询问，不要自动选择 dingtalk**
5. 阈值和指标字段尽量从对话上下文中提取
6. 如果信息不完整，先询问用户补充必要字段
7. **报表和大屏生成后直接展示在对话中，除非用户明确要求，否则不要调用 send_im_message 发送**

## 智能推荐
主动识别数据中的：
- 异常值或波动
- 趋势变化
- 相关性洞察
- 优化机会
- 适合监控的指标

## 根因分析能力
当用户询问某个指标为什么变化（如"为什么销售额下降了""GMV 异常是什么原因"）时，你可以：
1. 先给出初步分析假设和可能原因
2. 如果已有配置的指标和数据源，输出根因分析请求让系统自动执行下钻分析：

\`\`\`rca_request
{
  "metricId": "指标ID",
  "timeRange": "7d",
  "maxDepth": 3
}
\`\`\`

系统会自动执行：
- **维度下钻**：按地区、渠道、品类等维度拆解，找出贡献最大的因子
- **同比/环比对比**：周环比、月环比、年同比
- **关联指标分析**：识别高相关性的上下游指标
- **趋势预测**：预测未来走势

分析结果会自动返回并展示在对话中。

## 每日摘要查看
当用户询问"今日业务概况""给我看看今天的指标""业务健康状况"时，系统会自动获取每日摘要数据，包括核心指标速览、异常告警和趋势预测。`;

interface AIModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

interface ColumnInfo {
  field: string;
  type: string;
  nullable: boolean;
}

interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  recordCount: number;
}

interface TenantDataSourceContext {
  total: number;
  connected: number;
  dataSources: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    description?: string;
    database?: string;
    host?: string;
    lastSyncAt?: string;
    tables: string[];
    tablesInfo?: TableSchema[];
  }>;
}

function getDefaultBaseURLByModelType(modelType?: string): string | undefined {
  if (modelType === "minmax") {
    return "https://api.minimax.io/v1";
  }
  if (modelType === "deepseek") {
    return "https://api.deepseek.com/v1";
  }
  return undefined;
}

function getModelConfig(modelType?: string): AIModelConfig {
  const resolvedModelType = modelType || process.env.AI_MODEL_TYPE || "openai";

  switch (resolvedModelType) {
    case "minmax":
      return {
        model: process.env.MINIMAX_MODEL || "MiniMax-M2",
        maxTokens: 2000,
        temperature: 0.7,
      };
    case "claude":
      return {
        model: "claude-3-sonnet-20240229",
        maxTokens: 2000,
        temperature: 0.7,
      };
    case "qwen": // 通义千问
      return {
        model: "qwen-plus",
        maxTokens: 2000,
        temperature: 0.7,
      };
    case "ernie": // 文心一言
      return {
        model: "ernie-bot-4",
        maxTokens: 2000,
        temperature: 0.7,
      };
    default: // OpenAI
      return {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        maxTokens: 2000,
        temperature: 0.7,
      };
  }
}

export async function POST(req: NextRequest) {
  let finalModelType = process.env.AI_MODEL_TYPE || "openai";
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    const { 
      messages, 
      dataSummary, 
      dataSchema,
      companyProfile,
      conversationContext,
      tenantId: clientTenantId,
      aiConfig: clientAiConfig
    } = body as {
      messages: { role: string; content: string }[];
      dataSummary?: string;
      dataSchema?: any;
      companyProfile?: any;
      conversationContext?: any;
      tenantId?: string;
      aiConfig?: {
        apiKey?: string;
        baseUrl?: string;
        modelType?: string;
        model?: string;
      };
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "消息不能为空" },
        { status: 400 }
      );
    }
    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const tenantId =
      clientTenantId ||
      conversationContext?.tenantId ||
      companyProfile?.tenantId ||
      "demo-tenant";
    const analysisPacket = await getAnalysisPacketFromBackend(tenantId, latestUserMessage);
    const dataSourceContext = await getTenantDataSourcesContextFromBackend(tenantId, authHeader);

    // 自动预查询：如果有已连接的数据源，先执行 AutoQuery 获取真实数据
    const autoQueryData = await fetchAutoQueryData(
      tenantId,
      authHeader,
      dataSourceContext,
      latestUserMessage
    );

    const serverConfig = await getTenantAIConfigFromBackend(tenantId, authHeader);

    // 优先使用客户端传来的配置，其次服务端租户配置，最后环境变量
    const apiKey =
      clientAiConfig?.apiKey ||
      serverConfig?.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.AI_API_KEY;
    
    // 演示模式
    if (!apiKey) {
      const demoContent = dataSummary
        ? `根据你上传的数据：\n${dataSummary}\n\n**建议：**
1. 配置 API Key 启用真实 AI 分析
2. 尝试提问"帮我分析销售趋势"
3. 说"生成数据大屏"创建可视化`
        : "请先上传数据文件，然后我可以帮你分析。";
      
      return NextResponse.json(
        {
          content: "⚠️ 演示模式：未配置 AI API Key\n\n" + demoContent,
          demoMode: true,
        },
        { status: 200 }
      );
    }

    finalModelType =
      clientAiConfig?.modelType || serverConfig?.modelType || process.env.AI_MODEL_TYPE || "openai";
    const modelConfig = getModelConfig(finalModelType);
    
    // 如果客户端指定了模型，使用客户端的
    let finalModel = modelConfig.model;
    if (clientAiConfig?.model) {
      finalModel = clientAiConfig.model;
    } else if (serverConfig?.model) {
      finalModel = serverConfig.model;
    }

    const finalBaseURL =
      clientAiConfig?.baseUrl ||
      serverConfig?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      getDefaultBaseURLByModelType(finalModelType) ||
      undefined;
    
    // 构建增强版系统提示
    let systemContent = SYSTEM_PROMPT;
    
    if (companyProfile) {
      systemContent += `\n\n## 企业画像\n${JSON.stringify(companyProfile, null, 2)}`;
    }
    
    if (dataSchema) {
      systemContent += `\n\n## 数据结构\n${JSON.stringify(dataSchema, null, 2)}`;
    }
    
    if (dataSummary) {
      systemContent += `\n\n## 数据摘要\n${dataSummary}`;
    }

    if (conversationContext) {
      systemContent += `\n\n## 对话上下文\n${JSON.stringify(conversationContext, null, 2)}`;
    }
    if (dataSourceContext && dataSourceContext.total > 0) {
      // 构建更易用的数据源上下文：包含连接状态和表结构信息
      const enrichedDataSourceContext = dataSourceContext.dataSources.map(ds => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
        status: ds.status,
        database: ds.database,
        host: ds.host,
        tables: ds.tablesInfo && ds.tablesInfo.length > 0
          ? ds.tablesInfo.map(t => ({
              name: t.name,
              recordCount: t.recordCount,
              columns: t.columns.map(c => ({
                field: c.field,
                type: c.type,
                isNullable: c.nullable
              }))
            }))
          : ds.tables.map(name => ({ name, recordCount: 0, columns: [] }))
      }));
      systemContent += `\n\n## 已配置数据源上下文\n${JSON.stringify(enrichedDataSourceContext, null, 2)}`;
    }
    // 注入 AutoQuery 真实查询结果
    if (autoQueryData) {
      systemContent += `\n\n## 数据源真实查询结果（已自动执行聚合查询）\n${JSON.stringify(autoQueryData, null, 2)}`;
    }
    systemContent += `\n\n## AI分析引擎上下文（用于提高回答稳定性）\n${JSON.stringify(analysisPacket, null, 2)}`;

    const formattedMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const openai = new OpenAI({
      apiKey,
      baseURL: finalBaseURL,
    });

    // 定义 send_im_message 工具（通用 IM 发送）
    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "send_im_message",
          description: "发送即时消息到 IM 平台（钉钉、飞书、企业微信等）。当你想把对话中的内容主动推送给用户时调用此工具。系统会根据你指定的平台自动查找已配置并发送，无需用户确认。",
          parameters: {
            type: "object",
            properties: {
              platform: {
                type: "string",
                description: "目标 IM 平台，取值：dingtalk（钉钉）、feishu（飞书）、wecom（企业微信）、slack、telegram、discord。根据用户需求或对话上下文选择最合适的平台。",
                enum: ["dingtalk", "feishu", "wecom", "slack", "telegram", "discord"],
              },
              content: {
                type: "string",
                description: "要发送的消息内容，应简洁明了，去除 Markdown 格式标记",
              },
              markdown: {
                type: "boolean",
                description: "是否使用 Markdown 格式，默认为 false",
              },
            },
            required: ["platform", "content"],
          },
        },
      },
    ];

    // 构建初始消息列表（包含 system + user + assistant 的历史）
    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...formattedMessages,
    ];

    // 调用 AI API（带工具支持）
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (req.signal.aborted) {
            controller.close();
            return;
          }
          // 先发送 analysis 元数据
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "meta", analysis: analysisPacket, model: finalModel, autoQueryData })}\n\n`)
          );

          // 第一阶段：流式输出 AI 回复，同时收集 tool_calls
          const stream = await openai.chat.completions.create({
            model: finalModel,
            messages: allMessages,
            max_tokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
            tools,
            stream: true,
          }, {
            signal: req.signal,
          });

          let toolCallId = "";
          let toolCallArgs = "";
          let toolCallName = "";
          let hasToolCall = false;
          let assistantContent = "";

          for await (const chunk of stream) {
            if (req.signal.aborted) break;

            const delta = chunk.choices[0]?.delta;

            // 收集文本内容
            if (delta?.content) {
              assistantContent += delta.content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta.content })}\n\n`)
              );
            }

            // 收集 tool_call 片段
            if (delta?.tool_calls && delta.tool_calls.length > 0) {
              hasToolCall = true;
              const tc = delta.tool_calls[0];
              if (tc.id) toolCallId = tc.id;
              if (tc.function?.name) toolCallName = tc.function.name;
              if (tc.function?.arguments) {
                toolCallArgs += tc.function.arguments;
              }
            }
          }

          // 第二阶段：如果有 tool_call，执行工具并继续
          if (hasToolCall && toolCallId && toolCallArgs && !req.signal.aborted) {
            // 发送 tool_call 开始信号
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool_call", toolName: "send_im_message", toolCallId })}\n\n`)
            );

            // 解析参数
            let toolArgs: { platform?: string; content?: string; markdown?: boolean } = {};
            try {
              toolArgs = JSON.parse(toolCallArgs);
            } catch {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", error: "工具参数解析失败" })}\n\n`)
              );
              controller.close();
              return;
            }

            // 调用后端接口发送 IM 消息
            const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
            let toolResult = { success: false, message: "发送失败" };
            try {
              const sendRes = await fetch(`${backendBase}/internal/send-im`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tenantId: tenantId,
                  platform: toolArgs.platform || "",
                  content: toolArgs.content || "",
                  markdown: toolArgs.markdown || false,
                }),
                signal: AbortSignal.timeout(30000),
              });
              if (sendRes.ok) {
                const data = await sendRes.json();
                toolResult = { success: true, message: data.message || "消息已发送" };
              } else {
                const errData = await sendRes.json().catch(() => null);
                toolResult = { success: false, message: errData?.error || `HTTP ${sendRes.status}` };
              }
            } catch (err) {
              toolResult = { success: false, message: String(err) };
            }

            // 发送 tool_call 结果
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "tool_result", toolCallId, result: toolResult })}\n\n`)
            );

            // 第三阶段：把 tool 结果反馈给 AI，让它生成自然语言确认
            const assistantToolCallMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
              role: "assistant",
              content: assistantContent || null,
              tool_calls: [
                {
                  id: toolCallId,
                  type: "function",
                  function: {
                    name: toolCallName || "send_im_message",
                    arguments: toolCallArgs,
                  },
                },
              ],
            };
            const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              ...allMessages,
              assistantToolCallMessage,
              {
                role: "tool" as const,
                tool_call_id: toolCallId,
                content: JSON.stringify(toolResult),
              },
            ];

            const followUp = await openai.chat.completions.create({
              model: finalModel,
              messages: followUpMessages,
              max_tokens: 500,
              temperature: 0.3,
              stream: true,
            }, {
              signal: req.signal,
            });

            for await (const chunk of followUp) {
              if (req.signal.aborted) break;
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`)
                );
              }
            }
          }

          if (!req.signal.aborted) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          }
        } catch (err) {
          const msg = String((err as any)?.message || err);
          const isAbort =
            req.signal.aborted ||
            (err as any)?.name === "AbortError" ||
            msg.toLowerCase().includes("aborted");
          if (!isAbort) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(err) })}\n\n`)
            );
          }
        } finally {
          try {
            controller.close();
          } catch {
            // ignore close race when client disconnects
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Chat API error:", err);
    const errMessage = String(err?.message || "");
    const lowerErrMessage = errMessage.toLowerCase();
    
    // 错误分类处理
    if (
      finalModelType === "minmax" &&
      (lowerErrMessage.includes("insufficient balance") || errMessage.includes("1008"))
    ) {
      return NextResponse.json(
        {
          error:
            "MiniMax 余额不足（错误码 1008）。请在 MiniMax 控制台确认计费账户余额、API Key 所属项目是否正确，充值后稍等片刻再重试。",
        },
        { status: 402 }
      );
    }

    if (err.status === 401) {
      const providerHint =
        finalModelType === "deepseek"
          ? "（可能是 DeepSeek Base URL 未配置或配置错误，建议使用 https://api.deepseek.com/v1）"
          : finalModelType === "minmax"
            ? "（建议确认 Base URL 为 https://api.minimax.io/v1，模型名如 MiniMax-M2）"
            : "";
      return NextResponse.json(
        { error: `AI 认证失败，请检查 API Key / Base URL / 模型配置${providerHint}` },
        { status: 401 }
      );
    }
    
    if (err.status === 429) {
      return NextResponse.json(
        { error: "请求频率超限，请稍后重试" },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      {
        error: "AI 服务异常：" + errMessage,
        analysisEvaluation: getEvaluationSummary(),
      },
      { status: 500 }
    );
  }
}

async function getAnalysisPacketFromBackend(tenantId: string, question: string) {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/analysis/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenantId },
      body: JSON.stringify({ question }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`backend analysis failed: ${res.status}`);
    }
    const payload = await res.json();
    if (payload?.analysis) {
      return payload.analysis;
    }
  } catch {
    // ignore and fallback
  }

  return {
    ...analyzeQuestion(question),
    evaluation: getEvaluationSummary(),
  };
}

async function getTenantAIConfigFromBackend(tenantId: string, authHeader?: string | null): Promise<{
  apiKey?: string;
  baseUrl?: string;
  modelType?: string;
  model?: string;
} | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }
    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/ai-config`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    const payload = await res.json();
    return {
      apiKey: payload?.apiKey,
      baseUrl: payload?.baseUrl,
      modelType: payload?.modelType,
      model: payload?.model,
    };
  } catch {
    return null;
  }
}

// AutoQuery API 返回的数据类型
type AutoQueryData = {
  totalCount?: Record<string, number>;
  distributions?: Array<{
    tableName: string;
    columnName: string;
    columnType: string;
    topValues?: Array<{ label: string; value: number }>;
    rows?: Record<string, unknown>[];
  }>;
  timeTrends?: Array<{
    tableName: string;
    columnName: string;
    rows?: Record<string, unknown>[];
  }>;
  sampleRows?: Array<{
    tableName: string;
    rows?: Record<string, unknown>[];
  }>;
};

type AutoQueryResult = {
  success: boolean;
  data?: AutoQueryData;
  error?: string;
};

// 调用 AutoQuery API，自动生成并执行聚合查询
async function fetchAutoQueryData(
  tenantId: string,
  authHeader?: string | null,
  dataSourceContext?: TenantDataSourceContext | null,
  latestUserMessage?: string
): Promise<AutoQueryData | null> {
  if (!dataSourceContext || dataSourceContext.connected === 0) {
    return null;
  }

  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";

  // 只对已连接且有表结构的数据源进行查询
  const connectedDataSources = dataSourceContext.dataSources
    .filter(ds => ds.status === "connected" && ds.tablesInfo && ds.tablesInfo.length > 0)
    .map(ds => ({
      id: ds.id,
      name: ds.name,
      type: ds.type,
      database: ds.database,
      tablesInfo: ds.tablesInfo || [],
    }));

  if (connectedDataSources.length === 0) {
    return null;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/auto-query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        question: latestUserMessage || "",
        dataSources: connectedDataSources,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return null;
    }

    const result: AutoQueryResult = await res.json();
    if (result.success && result.data) {
      return result.data;
    }
  } catch {
    // AutoQuery 失败不影响主流程，静默降级
  }

  return null;
}

async function getTenantDataSourcesContextFromBackend(
  tenantId: string,
  authHeader?: string | null
): Promise<TenantDataSourceContext | null> {
  const backendBase = process.env.BACKEND_INTERNAL_URL || "http://localhost:3001";
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-ID": tenantId,
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const res = await fetch(`${backendBase}/api/tenants/${tenantId}/data-sources`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const payload = await res.json();
    if (!Array.isArray(payload)) {
      return null;
    }

    const normalized = payload
      .map((item: any) => {
        let tables: string[] = [];
        if (Array.isArray(item?.tables)) {
          tables = item.tables.filter((t: unknown): t is string => typeof t === "string");
        } else if (typeof item?.tableInfo === "string" && item.tableInfo.trim()) {
          try {
            const parsed = JSON.parse(item.tableInfo);
            if (Array.isArray(parsed)) {
              tables = parsed.filter((t: unknown): t is string => typeof t === "string");
            }
          } catch {
            // ignore invalid tableInfo
          }
        }

        return {
          id: String(item?.id || ""),
          name: String(item?.name || "未命名数据源"),
          type: String(item?.type || "unknown"),
          status: String(item?.status || "unknown"),
          description: typeof item?.description === "string" ? item.description : undefined,
          database: typeof item?.database === "string" ? item.database : undefined,
          host: typeof item?.host === "string" ? item.host : undefined,
          lastSyncAt: typeof item?.lastSyncAt === "string" ? item.lastSyncAt : undefined,
          tables: tables.slice(0, 100),
          tablesInfo: Array.isArray(item?.tablesInfo) ? item.tablesInfo.slice(0, 50) : undefined,
        };
      })
      .filter((item: { id: string; name: string }) => item.id || item.name);

    return {
      total: normalized.length,
      connected: normalized.filter((item: { status: string }) => item.status === "connected").length,
      dataSources: normalized.slice(0, 20),
    };
  } catch {
    return null;
  }
}
