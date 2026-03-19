export interface DashboardData {
  months: string[];
  sales: number[];
  profit: number[];
  channels: { value: number; name: string }[];
  regions: string[];
  regionSales: number[];
  totalSales: number;
  growth: number;
  customers: number;
}

export type DataSourceType =
  | "mysql"
  | "postgresql"
  | "sqlserver"
  | "oracle"
  | "mongodb"
  | "redis"
  | "elasticsearch"
  | "clickhouse"
  | "snowflake"
  | "bigquery"
  | "hive"
  | "spark"
  | "csv"
  | "excel"
  | "api"
  | "s3"
  | "kafka"
  | "other";

export interface DataSourceConfig {
  id: string;
  type: DataSourceType;
  name: string;
  description?: string;
}

export interface CompanyInfo {
  companyName: string;
  industry: string;
  size: string;
  region: string;
  businessModel: string;
  coreGoals: string;
}

export interface CompanyProfile {
  summary: string;
  analysisFocuses: string[];
  recommendedMetrics: string[];
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  isOnboarded: boolean;
  companyInfo?: CompanyInfo;
  dataSources?: DataSourceConfig[];
  companyProfile?: CompanyProfile;
}

export interface DashboardConfig {
  id: string;
  title: string;
  templateId: string;
  createdAt: number;
  updatedAt: number;
  data: DashboardData;
  thumbnail?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; summary?: string }[];
  timestamp: number;
}

export type DashboardTemplateId = "sales" | "operations" | "finance" | "custom";

export interface DashboardTemplate {
  id: DashboardTemplateId;
  name: string;
  description: string;
  layout: string;
}

/* ---- 钉钉通知事件 ---- */

export interface NotificationRule {
  id: string;
  name: string;
  /** 用户用自然语言描述的触发条件，如"当日销售额超过1000" */
  condition: string;
  /** 通知消息模板 */
  messageTemplate: string;
  /** 钉钉 Webhook URL */
  webhookUrl: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** chat API 返回中可能携带的通知事件操作指令 */
export interface NotificationAction {
  type: "create" | "update" | "delete" | "list";
  rule?: Omit<NotificationRule, "id" | "createdAt" | "updatedAt">;
  ruleId?: string;
}
