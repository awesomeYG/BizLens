/** 旧版 DashboardData，保留向后兼容 */
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

// ==================== 泛化大屏数据模型 ====================

/** 通用数据序列 -- 用于折线/柱状/面积等图表 */
export interface SeriesData {
  name: string;
  values: number[];
  color?: string;
}

/** 通用 KPI 卡片数据 */
export interface KpiItem {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  color?: string;
  icon?: string;
}

/** 通用饼图/环形图数据 */
export interface PieItem {
  name: string;
  value: number;
}

/** 通用排行榜数据 */
export interface RankingItem {
  label: string;
  value: number;
  maxValue?: number;
}

/** 通用漏斗数据 */
export interface FunnelItem {
  name: string;
  value: number;
}

/** 通用表格数据 */
export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

/** 通用仪表盘数据 */
export interface GaugeData {
  name: string;
  value: number;
  min?: number;
  max?: number;
  color?: string;
}

/** 雷达图数据 */
export interface RadarSeriesData {
  name: string;
  values: number[];
}

/** 散点图数据项 */
export interface ScatterItem {
  x: number;
  y: number;
}

/** 散点图数据 */
export interface ScatterSeriesData {
  name: string;
  values: ScatterItem[];
}

/** 热力图数据项 */
export interface HeatmapItem {
  x: number;
  y: number;
  value: number;
}

/** 散点图/热力图数据 */
export interface ScatterSeries {
  name: string;
  values: (ScatterItem | number[]) | HeatmapItem[];
}

/** 泛化的大屏区块数据 -- 每个 Section 携带自己的数据 */
export interface SectionData {
  kpiItems?: KpiItem[];
  categories?: string[];
  series?: SeriesData[];
  pieItems?: PieItem[];
  rankingItems?: RankingItem[];
  funnelItems?: FunnelItem[];
  tableData?: TableData;
  gaugeData?: GaugeData;
  // 雷达图数据
  radarIndicator?: string[];
  radarSeries?: RadarSeriesData[];
  // 散点图数据
  scatterSeries?: ScatterSeries[];
  // 热力图数据
  heatmapSeries?: ScatterSeries[];
  // 自定义数据
  customData?: Record<string, any>;
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
  // AI Schema 分析状态
  schemaAnalyzed?: boolean;
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
  tenantId?: string;
  name: string;
  email: string;
  role?: string;
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

export interface ChatConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messages: ChatMessage[];
}

export type DashboardTemplateId =
  | "sales"
  | "operations"
  | "finance"
  | "promotion"
  | "ecommerce"
  | "saas"
  | "marketing"
  | "supply-chain"
  | "customer"
  | "custom";

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
  /** 模板包含的区块配置 */
  sections?: DashboardSection[];
  /** 布局列数 (默认 12) */
  gridCols?: number;
  /** 配色方案标识 */
  colorTone?: string;
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
  | "gauge"
  | "radar"
  | "scatter"
  | "heatmap"
  | "custom";

// 大屏区块配置
export interface DashboardSection {
  id: string;
  type: DashboardSectionType;
  title?: string;
  subtitle?: string;
  metrics?: string[];
  dimensions?: string[];
  chartConfig?: any;
  // 布局配置 -- colSpan/rowSpan 用于 grid 布局
  row?: number;
  col?: number;
  width?: number;
  height?: number;
  colSpan?: number;
  rowSpan?: number;
  priority?: number;
  // 数据配置
  timeGrain?: string;
  topN?: number;
  comparison?: string;
  splitBy?: string;
  filterExpr?: string;
  // 区块携带的样本/默认数据
  data?: SectionData;
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
  unactivated?: boolean;  // 系统是否未激活
  systemName?: string;
  version?: string;
}

export interface AuthError {
  code: string;
  message: string;
}

export interface ActivateRequest {
  licenseKey: string;
  name: string;
  email: string;
  password: string;
}

export interface ActivateResponse {
  activated: boolean;
  user?: User;
  tokens?: Tokens;
  error?: string;
  code?: string;
}

// 更新 UserSession 以支持 Token
export interface UserSessionWithAuth extends UserSession {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  role?: string;
}

// ==================== 报表相关类型 ====================

export type ReportStatus = "draft" | "published" | "archived";
export type ReportType = "daily" | "weekly" | "monthly" | "custom" | "realtime";
export type ReportCategory = "sales" | "finance" | "operations" | "marketing" | "custom";

/** 报表区块 */
export interface ReportSection {
  id: string;
  reportId: string;
  type: DashboardSectionType;
  title?: string;
  metrics?: string[];
  dimensions?: string[];
  chartConfig?: Record<string, any>;
  dataConfig?: Record<string, any>;
  sortOrder: number;
  colSpan: number;
  rowSpan: number;
  timeGrain?: string;
  topN?: number;
  comparison?: string;
  filterExpr?: string;
}

/** 报表 */
export interface Report {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  type: ReportType;
  status: ReportStatus;
  category: string;
  tags: string[];
  dataSourceId?: string;
  layoutConfig?: string;
  colorPalette?: string;
  scheduleEnabled: boolean;
  scheduleCron?: string;
  aiGenerated: boolean;
  aiPrompt?: string;
  viewCount: number;
  createdBy: string;
  sections?: ReportSection[];
  createdAt: string;
  updatedAt: string;
}

/** 创建报表区块请求 */
export interface CreateReportSectionRequest {
  type: DashboardSectionType;
  title?: string;
  metrics?: string[];
  dimensions?: string[];
  chartConfig?: Record<string, any>;
  dataConfig?: Record<string, any>;
  sortOrder?: number;
  colSpan?: number;
  rowSpan?: number;
  timeGrain?: string;
  topN?: number;
  comparison?: string;
  filterExpr?: string;
}

/** 创建报表请求 */
export interface CreateReportRequest {
  title: string;
  description?: string;
  type?: ReportType;
  category?: string;
  tags?: string[];
  dataSourceId?: string;
  layoutConfig?: string;
  colorPalette?: string;
  aiGenerated?: boolean;
  aiPrompt?: string;
  sections?: CreateReportSectionRequest[];
}

/** 更新报表请求 */
export interface UpdateReportRequest {
  title?: string;
  description?: string;
  type?: ReportType;
  status?: ReportStatus;
  category?: string;
  tags?: string[];
  dataSourceId?: string;
  layoutConfig?: string;
  colorPalette?: string;
  sections?: CreateReportSectionRequest[];
}
