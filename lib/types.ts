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

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface DataSourceConfig {
  id: string;
  type: DataSourceType;
  name: string;
  description?: string;
  // 数据库连接配置（仅当 type 为 mysql/postgresql 等时使用）
  connection?: DatabaseConnectionConfig;
  // API 数据源配置
  apiConfig?: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    authType?: "none" | "bearer" | "basic" | "apikey";
    authToken?: string;
  };
  // 文件数据源
  fileConfig?: {
    fileName: string;
    fileSize: number;
    uploadedAt: number;
  };
  // 连接状态
  status?: "connected" | "disconnected" | "error";
  lastSyncAt?: number;
  // 数据表/集合信息（连接后自动获取）
  tables?: string[];
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
