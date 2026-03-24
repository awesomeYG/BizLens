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
  | "sqlite"
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
  // SQL 相关
  sqlQuery?: {
    sql: string;
    executed?: boolean;
    error?: string;
    result?: any[];
  };
  // Schema 上下文
  schemaContext?: string;
}

export type DashboardTemplateId = "sales" | "operations" | "finance" | "promotion" | "custom";

export interface DashboardTemplate {
  id: DashboardTemplateId;
  name: string;
  description: string;
  layout: string;
  category: string;
  icon?: string;
  isSystem?: boolean;
  tags?: string[];
  usageCount?: number;
}

// 大屏区块类型
export type DashboardSectionType =
  | "kpi"
  | "trend"
  | "ranking"
  | "map"
  | "pie"
  | "bar"
  | "line"
  | "area"
  | "funnel"
  | "table"
  | "insight"
  | "alert"
  | "custom";

// 大屏区块配置
export interface DashboardSection {
  id: string;
  type: DashboardSectionType;
  title?: string;
  metrics?: string[];
  dimensions?: string[];
  chartConfig?: any;
  // 布局配置
  row?: number;
  col?: number;
  width?: number;
  height?: number;
  priority?: number;
  // 数据配置
  timeGrain?: string;
  topN?: number;
  comparison?: string;
  splitBy?: string;
  filterExpr?: string;
  // AI 配置
  autoGenerate?: boolean;
}

// 布局配置
export interface LayoutConfig {
  columns: number;
  rows: "auto" | number;
  highlight?: string;
  responsive: boolean;
}

// 配色方案
export interface ColorPalette {
  primary: string;
  secondary: string;
  alert: {
    up: string;
    down: string;
  };
}

// 模板配置（用于自动生成）
export interface StoryTemplate {
  title: string;
  sections: Array<{
    type: DashboardSectionType;
    metrics?: string[];
    layout?: string;
    timeGrain?: string;
    chart?: string;
    topN?: number;
    stages?: string[];
    threshold?: string;
  }[]>;
}

// ==================== 认证相关类型 ====================

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  lastLoginAt?: string;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  tenantId: string;
  email: string;
  password: string;
  name: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface AuthError {
  code: string;
  message: string;
}

// 更新 UserSession 以支持 Token
export interface UserSessionWithAuth extends UserSession {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
}
