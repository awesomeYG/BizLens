import type { IMPlatformMeta, IMConfigField } from "./types";

const COMMON_WEBHOOK_FIELD: IMConfigField = {
  key: "webhookUrl",
  label: "Webhook 地址",
  placeholder: "https://...",
  required: true,
  type: "url",
};

/**
 * 各 IM 平台的元信息（纯前端展示用）
 * 新增平台只需在此追加
 */
export const IM_PLATFORM_REGISTRY: Record<string, IMPlatformMeta> = {
  dingtalk: {
    type: "dingtalk",
    label: "钉钉",
    description: "通过钉钉自定义机器人发送群消息和通知",
    color: "#0089FF",
    iconBg: "bg-blue-500/20",
    fields: [
      COMMON_WEBHOOK_FIELD,
      { key: "secret", label: "签名密钥（Secret）", placeholder: "SEC...", required: false, type: "password" },
    ],
  },
  feishu: {
    type: "feishu",
    label: "飞书",
    description: "通过飞书自定义机器人发送群消息和通知",
    color: "#00D6B9",
    iconBg: "bg-emerald-500/20",
    fields: [
      COMMON_WEBHOOK_FIELD,
      { key: "secret", label: "签名密钥（Secret）", placeholder: "签名校验密钥", required: false, type: "password" },
    ],
  },
  wecom: {
    type: "wecom",
    label: "企业微信",
    description: "通过企业微信群机器人发送消息和通知",
    color: "#07C160",
    iconBg: "bg-green-500/20",
    fields: [COMMON_WEBHOOK_FIELD],
  },
};

export const IM_PLATFORMS_LIST = Object.values(IM_PLATFORM_REGISTRY);
