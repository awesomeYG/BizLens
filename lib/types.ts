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
