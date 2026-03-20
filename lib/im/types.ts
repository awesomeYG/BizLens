/**
 * IM 平台类型标识
 */
export type IMPlatformType = "dingtalk" | "feishu" | "wecom";

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
