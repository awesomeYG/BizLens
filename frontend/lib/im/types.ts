/**
 * IM 平台类型标识
 */
export type IMPlatformType = "dingtalk" | "feishu" | "wecom" | "slack" | "telegram" | "discord";

/**
 * IM 平台连接状态
 */
export type IMConnectionStatus = "connected" | "disconnected" | "error";

/**
 * IM 平台配置（与后端 model 对齐）
 */
export interface IMPlatformConfig {
  id: string;
  tenantId: string;
  type: IMPlatformType;
  name: string;
  enabled: boolean;
  webhookUrl: string;
  secret?: string;
  /** 钉钉自定义机器人安全设置中的关键词（可选） */
  keyword?: string;
  status: IMConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * IM 平台元信息（前端 UI 展示用）
 */
export interface IMPlatformMeta {
  type: IMPlatformType;
  label: string;
  description: string;
  color: string;
  iconBg: string;
  fields: IMConfigField[];
}

export interface IMConfigField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: "text" | "password" | "url";
}

/**
 * 通知模板类型
 */
export type NotificationTemplateType =
  | "data_alert"
  | "report_ready"
  | "dashboard_update"
  | "custom";

/**
 * 通知记录（与后端 model 对齐）
 */
export interface NotificationRecord {
  id: string;
  tenantId: string;
  platformId: string;
  platformType: IMPlatformType;
  templateType: NotificationTemplateType;
  title: string;
  content: string;
  markdown: boolean;
  status: "pending" | "sent" | "failed";
  error?: string;
  sentAt: string;
}

/**
 * 创建/更新 IM 配置的请求体
 */
export interface IMConfigCreateRequest {
  type: IMPlatformType;
  name: string;
  webhookUrl: string;
  secret?: string;
  keyword?: string;
  enabled?: boolean;
}

/**
 * 发送通知的请求体
 */
export interface NotificationSendRequest {
  platformIds: string[];
  templateType: NotificationTemplateType;
  title: string;
  content: string;
  markdown?: boolean;
}

/**
 * 告警条件类型
 */
export type AlertConditionType = "greater" | "less" | "equals" | "change" | "custom";

/**
 * 告警来源类型
 */
export type AlertSourceType = "quick_alert" | "auto_rule";

/**
 * 通知规则类型
 */
export type NotificationRuleType = "data_threshold" | "data_change" | "scheduled" | "custom";

/**
 * 通知频率
 */
export type NotificationFrequency = "once" | "hourly" | "daily" | "weekly" | "monthly" | "realtime";

/**
 * 告警事件配置（与后端 model 对齐）
 */
export interface AlertEvent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  enabled: boolean;
  metric: string;
  conditionType: AlertConditionType;
  threshold: number;
  message: string;
  platformIds: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建告警事件请求体
 */
export interface AlertEventCreateRequest {
  name: string;
  description?: string;
  metric: string;
  conditionType: AlertConditionType;
  threshold: number;
  message: string;
  platformIds: string;
  enabled?: boolean;
}

/**
 * 告警触发记录
 */
export interface AlertTriggerLog {
  id: string;
  tenantId: string;
  eventId: string;
  eventName: string;
  metric: string;
  actualValue: number;
  threshold: number;
  message: string;
  status: string;
  error?: string;
  sourceType?: AlertSourceType; // quick_alert / auto_rule
  triggeredAt: string;
  createdAt: string;
}

/**
 * 统一告警项（前端展示用）
 */
export interface UnifiedAlertItem {
  id: string;
  type: AlertSourceType;
  name: string;
  description?: string;
  enabled: boolean;
  // 快速告警字段
  metric?: string;
  conditionType?: AlertConditionType;
  threshold?: number;
  message?: string;
  platformIds?: string;
  // 自动规则字段
  ruleType?: NotificationRuleType;
  frequency?: NotificationFrequency;
  dataSourceId?: string;
  tableName?: string;
  metricField?: string;
  conditionExpr?: string;
  scheduleTime?: string;
  timeRange?: string;
  messageTemplate?: string;
  messageTitle?: string;
  webhookUrl?: string;
  nlQuery?: string;
  // 通用字段
  createdAt: string;
  updatedAt: string;
}

/**
 * 统一告警创建请求
 */
export interface UnifiedAlertCreateRequest {
  type: AlertSourceType;
  name: string;
  description?: string;
  enabled?: boolean;
  // 快速告警字段
  metric?: string;
  conditionType?: AlertConditionType;
  threshold?: number;
  message?: string;
  platformIds?: string;
  // 自动规则字段
  ruleType?: NotificationRuleType;
  frequency?: NotificationFrequency;
  dataSourceId?: string;
  tableName?: string;
  metricField?: string;
  conditionExpr?: string;
  scheduleTime?: string;
  timeRange?: string;
  messageTemplate?: string;
  messageTitle?: string;
  webhookUrl?: string;
  nlQuery?: string;
}

/**
 * 告警条件选项（UI 展示用）
 */
export const ALERT_CONDITION_OPTIONS: { value: AlertConditionType; label: string; symbol: string }[] = [
  { value: "greater", label: "大于", symbol: ">" },
  { value: "less", label: "小于", symbol: "<" },
  { value: "equals", label: "等于", symbol: "=" },
  { value: "change", label: "变化幅度", symbol: "~" },
  { value: "custom", label: "自定义", symbol: "?" },
];

/**
 * 通知规则类型选项
 */
export const RULE_TYPE_OPTIONS: { value: NotificationRuleType; label: string; description: string }[] = [
  { value: "data_threshold", label: "数据阈值", description: "当指标值超过或低于阈值时触发" },
  { value: "data_change", label: "数据变化", description: "当指标值发生显著变化时触发" },
  { value: "scheduled", label: "定时发送", description: "按设定时间周期发送通知" },
  { value: "custom", label: "自定义条件", description: "使用自定义 SQL 条件触发" },
];

/**
 * 通知频率选项
 */
export const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: "once", label: "仅一次" },
  { value: "hourly", label: "每小时" },
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "realtime", label: "实时" },
];

/**
 * 时间范围选项
 */
export const TIME_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨日" },
  { value: "last_7_days", label: "近 7 天" },
  { value: "last_30_days", label: "近 30 天" },
];
