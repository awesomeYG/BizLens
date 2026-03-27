/**
 * AI 响应动作处理器
 * 负责从 AI 响应中提取配置块并调用相应的后端接口
 */

import {
  extractDashboardConfig,
  extractDatasourceConfig,
  extractAlertConfig,
  extractNotificationRule,
  removeActionBlocks,
} from "./response-parser";
import { getAccessToken } from "@/lib/auth/api";
import { createDashboardInstance } from "@/lib/dashboard-store";
import type { DashboardSection } from "@/lib/types";

/**
 * 动作处理结果
 */
export interface ActionResult {
  type: "dashboard" | "datasource" | "alert" | "notification_rule";
  success: boolean;
  message: string;
  cleanContent: string;
  metadata?: Record<string, unknown>;
}

/**
 * 从响应内容中提取并执行所有动作
 */
export async function processResponseActions(
  rawContent: string,
  tenantId: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  // 1. 处理大屏配置
  const dashboardResult = await handleDashboardAction(rawContent);
  if (dashboardResult) {
    results.push(dashboardResult);
    // 如果 cleanContent 变化了，后续动作要用新的 content
    if (dashboardResult.cleanContent) rawContent = dashboardResult.cleanContent;
  }

  // 2. 处理告警配置
  const alertResult = await handleAlertAction(rawContent, tenantId);
  if (alertResult) {
    results.push(alertResult);
    if (alertResult.cleanContent) rawContent = alertResult.cleanContent;
  }

  // 3. 处理通知规则
  const notificationResult = await handleNotificationRuleAction(rawContent, tenantId);
  if (notificationResult) {
    results.push(notificationResult);
    if (notificationResult.cleanContent) rawContent = notificationResult.cleanContent;
  }

  // 4. 处理数据源配置
  const datasourceResult = await handleDatasourceAction(rawContent, tenantId);
  if (datasourceResult) {
    results.push(datasourceResult);
  }

  return results;
}

/**
 * 处理大屏配置
 */
async function handleDashboardAction(
  content: string
): Promise<ActionResult | null> {
  const parsed = extractDashboardConfig(content);
  if (!parsed) return null;

  const { sections, title, cleanContent } = parsed;

  try {
    const saved = await createDashboardInstance({
      title: title || "AI 生成大屏",
      sections,
    });

    return {
      type: "dashboard",
      success: true,
      message: `大屏「${saved.title}」已自动创建，可前往 /dashboards?id=${saved.id} 查看。`,
      cleanContent: cleanContent || removeActionBlocks(content),
      metadata: { dashboardId: saved.id, title: saved.title },
    };
  } catch (err) {
    return {
      type: "dashboard",
      success: false,
      message: `创建大屏失败：${err instanceof Error ? err.message : "未知错误"}`,
      cleanContent: cleanContent || removeActionBlocks(content),
    };
  }
}

/**
 * 处理告警配置
 */
async function handleAlertAction(
  content: string,
  tenantId: string
): Promise<ActionResult | null> {
  const parsed = extractAlertConfig(content);
  if (!parsed) return null;

  const { config, cleanContent } = parsed;
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`/api/tenants/${tenantId}/alerts`, {
      method: "POST",
      headers,
      body: JSON.stringify(config),
    });

    const clean = parsed.cleanContent;
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || `HTTP ${res.status}`;
      return {
        type: "alert",
        success: false,
        message: `告警规则创建失败：${errMsg}`,
        cleanContent: clean,
      };
    }

    const created = await res.json();
    return {
      type: "alert",
      success: true,
      message: `告警规则「${created.name || (config as Record<string, unknown>).name || "未命名"}」已自动创建。可前往 [告警配置](/alerts/config) 页面查看和调整。`,
      cleanContent: clean,
      metadata: { alertId: created.id, name: created.name },
    };
  } catch (err) {
    return {
      type: "alert",
      success: false,
      message: `创建告警规则失败：${err instanceof Error ? err.message : "未知错误"}`,
      cleanContent,
    };
  }
}

/**
 * 处理通知规则
 */
async function handleNotificationRuleAction(
  content: string,
  tenantId: string
): Promise<ActionResult | null> {
  const parsed = extractNotificationRule(content);
  if (!parsed) return null;

  const { config, cleanContent } = parsed;
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    // 先获取已启用的 IM 配置
    const imRes = await fetch(`/api/tenants/${tenantId}/im-configs`, { headers });
    const imConfigs = imRes.ok ? await imRes.json() : [];
    const enabledConfigs = Array.isArray(imConfigs) ? imConfigs.filter((c: unknown) => c && typeof c === "object") : [];

    // 解析平台 ID
    const rawPlatformValue = (config as Record<string, unknown>).platformIds;
    const rawPlatformIds = Array.isArray(rawPlatformValue)
      ? rawPlatformValue.map(String).join(",").trim()
      : typeof rawPlatformValue === "string"
        ? (rawPlatformValue as string).trim()
        : "";

    const requestedTokens = rawPlatformIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // 匹配平台配置
    const resolvedIds = new Set<string>();
    const unresolvedTokens: string[] = [];

    for (const tokenItem of requestedTokens) {
      const tokenLower = tokenItem.toLowerCase();
      const matched = enabledConfigs.filter((cfg: any) => {
        const id = String(cfg?.id || "");
        const type = String(cfg?.type || "").toLowerCase();
        const name = String(cfg?.name || "").toLowerCase();
        return id === tokenItem || type === tokenLower || name.includes(tokenLower);
      });
      if (matched.length > 0) {
        matched.forEach((cfg: any) => resolvedIds.add(String(cfg.id)));
      } else {
        unresolvedTokens.push(tokenItem);
      }
    }

    // 更新平台 ID
    ;(config as Record<string, unknown>).platformIds = Array.from(resolvedIds).join(",");

    // 创建通知规则
    const ruleRes = await fetch(`/api/tenants/${tenantId}/notification-rules`, {
      method: "POST",
      headers,
      body: JSON.stringify(config),
    });

    if (!ruleRes.ok) {
      const errData = await ruleRes.json().catch(() => null);
      const errMsg = errData?.error || `HTTP ${ruleRes.status}`;
      return {
        type: "notification_rule",
        success: false,
        message: `通知规则创建失败：${errMsg}`,
        cleanContent,
      };
    }

    const created = await ruleRes.json();
    const unresolvedText =
      unresolvedTokens.length > 0
        ? `\n- 未匹配平台：${unresolvedTokens.join(", ")}（请在 IM 配置页检查）`
        : "";
    const pairStatus = resolvedIds.size > 0 ? "已自动完成平台配对" : "未匹配到可用平台配置";

    return {
      type: "notification_rule",
      success: true,
      message:
        `通知规则「${created.name || (config as Record<string, unknown>).name || "未命名规则"}」已自动创建，${pairStatus}。` +
        `\n\n**核对入口**：\n- [查看通知规则](/im/rules?ruleId=${created.id})\n- [检查 IM 配置](/im/settings)` +
        unresolvedText,
      cleanContent,
      metadata: { ruleId: created.id, name: created.name, resolvedPlatforms: Array.from(resolvedIds) },
    };
  } catch (err) {
    return {
      type: "notification_rule",
      success: false,
      message: `创建通知规则失败：${err instanceof Error ? err.message : "未知错误"}`,
      cleanContent,
    };
  }
}

/**
 * 处理数据源配置
 */
async function handleDatasourceAction(
  content: string,
  tenantId: string
): Promise<ActionResult | null> {
  const parsed = extractDatasourceConfig(content);
  if (!parsed) return null;

  const { config, cleanContent } = parsed;
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`/api/tenants/${tenantId}/data-sources`, {
      method: "POST",
      headers,
      body: JSON.stringify(config),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || `HTTP ${res.status}`;
      return {
        type: "datasource",
        success: false,
        message: `数据源配置失败：${errMsg}`,
        cleanContent,
      };
    }

    const created = await res.json();
    const connInfo = (config as Record<string, unknown>).connection as Record<string, unknown> || {};

    return {
      type: "datasource",
      success: true,
      message:
        `数据源「${created.name || (config as Record<string, unknown>).name || "未命名"}」已自动配置成功！\n\n` +
        `**连接详情**：\n` +
        `- 类型：${((config as Record<string, unknown>).type || "").toString().toUpperCase()}\n` +
        `- 主机：${connInfo.host}:${connInfo.port}\n` +
        `- 数据库：${connInfo.database}\n` +
        `- 状态：已连接\n\n` +
        `你可以前往 [数据源管理](/settings/data-sources) 页面查看详情，或直接开始数据分析。`,
      cleanContent,
      metadata: { dataSourceId: created.id, name: created.name },
    };
  } catch (err) {
    return {
      type: "datasource",
      success: false,
      message: `数据源配置失败：${err instanceof Error ? err.message : "未知错误"}`,
      cleanContent,
    };
  }
}

/**
 * 更新消息内容（追加动作结果）
 */
export function appendActionResultsToContent(
  content: string,
  results: ActionResult[]
): string {
  if (results.length === 0) return content;

  // 先移除已有的配置块
  let cleanContent = removeActionBlocks(content);

  // 按顺序追加动作结果
  const actionMessages = results.map((r) => `\n\n${r.message}`);
  return cleanContent + actionMessages.join("");
}

/**
 * 直接创建数据源（从 URI）
 */
export async function createDataSourceFromURI(
  tenantId: string,
  parsedConn: {
    type: "postgresql" | "mysql";
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  }
): Promise<{ success: boolean; message: string; created?: unknown }> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const dsPayload = {
    type: parsedConn.type,
    name: `${parsedConn.database} 数据库`,
    description: `通过聊天自动配置（${parsedConn.host}:${parsedConn.port}/${parsedConn.database}）`,
    connection: {
      host: parsedConn.host,
      port: parsedConn.port,
      database: parsedConn.database,
      username: parsedConn.username,
      password: parsedConn.password,
      ssl: parsedConn.ssl ?? false,
    },
  };

  try {
    const res = await fetch(`/api/tenants/${tenantId}/data-sources`, {
      method: "POST",
      headers,
      body: JSON.stringify(dsPayload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || `HTTP ${res.status}`;
      const diagnosis = errData?.connectionDiagnosis as Record<string, string> | undefined;
      const diagnosisText = diagnosis
        ? `\n\n**连接诊断**：\n` +
          `- DNS：${diagnosis.dnsMessage || "未返回"}\n` +
          `- TCP：${diagnosis.tcpMessage || "未返回"}\n` +
          `- TLS：${diagnosis.tlsMessage || "未返回"}\n` +
          `- 鉴权：${diagnosis.authMessage || "未返回"}\n` +
          `- 建议 SSL：${diagnosis.recommendedSSL || "未返回"}\n` +
          `- 结论：${diagnosis.diagnosisSummary || "未返回"}`
        : "";

      return {
        success: false,
        message:
          `已识别到数据库连接串，但自动配置失败：${errMsg}${diagnosisText}\n\n` +
          `请确认连接串可访问，或前往 [数据源管理](/settings/data-sources) 页面查看。`,
      };
    }

    const created = await res.json().catch(() => null);
    return {
      success: true,
      message:
        `已为你自动配置数据源「${created?.name || dsPayload.name}」。\n\n` +
        `- 类型：${parsedConn.type.toUpperCase()}\n` +
        `- 主机：${parsedConn.host}:${parsedConn.port}\n` +
        `- 数据库：${parsedConn.database}\n` +
        `- 用户名：${parsedConn.username}\n\n` +
        `现在可以直接继续提问分析，例如"帮我看下最近7天的销售趋势"。`,
      created,
    };
  } catch (err) {
    return {
      success: false,
      message: `创建数据源失败：${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}
