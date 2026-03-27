/**
 * AI 对话响应解析工具
 * 负责从 AI 响应中提取结构化配置块（数据源、大屏、告警、通知规则、报表等）
 */

import type { DashboardSection } from "@/lib/types";

/**
 * 解析 AI 响应中的配置块
 */
export interface ParsedConfig<T = unknown> {
  type: "datasource" | "dashboard" | "alert" | "notification_rule" | "report" | "rca_request";
  raw: string;
  config: T;
  cleanContent: string; // 移除配置块后的内容
}

interface DashboardParsedConfig {
  sections: DashboardSection[];
  title?: string;
}

/**
 * 通用配置块正则匹配
 */
function extractConfigBlock<T>(
  content: string,
  blockType: ParsedConfig["type"],
  pattern: RegExp
): ParsedConfig<T> | null {
  const match = pattern.exec(content);
  if (!match) return null;

  try {
    const config = JSON.parse(match[1]) as T;
    const cleanContent = content.replace(pattern, "").trim();
    return { type: blockType, raw: match[0], config, cleanContent };
  } catch {
    return null;
  }
}

/**
 * 提取 dashboard_config 块
 */
export function extractDashboardConfig(
  content: string
): { sections: DashboardSection[]; title?: string; cleanContent: string } | null {
  const regex = /```dashboard_config\s*\n([\s\S]*?)\n```/;
  const parsed = extractConfigBlock<DashboardParsedConfig>(content, "dashboard", regex);
  if (!parsed) return null;

  const { config, cleanContent } = parsed;
  if (!config.sections || !Array.isArray(config.sections)) return null;

  return {
    sections: config.sections,
    title: config.title,
    cleanContent,
  };
}

/**
 * 提取 datasource_config 块
 */
export function extractDatasourceConfig(
  content: string
): { config: Record<string, unknown>; cleanContent: string } | null {
  const regex = /```datasource_config\s*\n([\s\S]*?)\n```/;
  const parsed = extractConfigBlock<Record<string, unknown>>(content, "datasource", regex);
  if (!parsed) return null;
  return { config: parsed.config, cleanContent: parsed.cleanContent };
}

/**
 * 提取 alert_config 块
 */
export function extractAlertConfig(
  content: string
): { config: Record<string, unknown>; cleanContent: string } | null {
  const regex = /```alert_config\s*\n([\s\S]*?)\n```/;
  const parsed = extractConfigBlock<Record<string, unknown>>(content, "alert", regex);
  if (!parsed) return null;
  return { config: parsed.config, cleanContent: parsed.cleanContent };
}

/**
 * 提取 notification_rule 块
 */
export function extractNotificationRule(
  content: string
): { config: Record<string, unknown>; cleanContent: string } | null {
  const regex = /```notification_rule\s*\n([\s\S]*?)\n```/;
  const parsed = extractConfigBlock<Record<string, unknown>>(content, "notification_rule", regex);
  if (!parsed) return null;
  return { config: parsed.config, cleanContent: parsed.cleanContent };
}

/**
 * 提取 report_config 块
 */
export function extractReportConfig(
  content: string
): { config: Record<string, unknown>; cleanContent: string } | null {
  const regex = /```report_config\s*\n([\s\S]*?)\n```/;
  const parsed = extractConfigBlock<Record<string, unknown>>(content, "report", regex);
  if (!parsed) return null;
  return { config: parsed.config, cleanContent: parsed.cleanContent };
}

/**
 * 移除所有动作块（配置块）
 */
export function removeActionBlocks(content: string): string {
  return content
    .replace(/```dashboard_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```datasource_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```alert_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```notification_rule\s*\n[\s\S]*?\n```/g, "")
    .replace(/```report_config\s*\n[\s\S]*?\n```/g, "")
    .replace(/```rca_request\s*\n[\s\S]*?\n```/g, "")
    .trim();
}

/**
 * 解析数据库连接 URI
 */
export interface ParsedConnection {
  type: "postgresql" | "mysql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export function parseConnectionUriFromText(text: string): ParsedConnection | null {
  const uriRegex = /\b(postgres(?:ql)?|mysql):\/\/[^\s"'<>]+/i;
  const match = uriRegex.exec(text);
  if (!match) return null;

  let normalized = match[0];
  if (/^postgres:\/\//i.test(normalized)) {
    normalized = normalized.replace(/^postgres:\/\//i, "postgresql://");
  }

  try {
    const url = new URL(normalized);
    const scheme = url.protocol.replace(":", "").toLowerCase();
    if (scheme !== "postgresql" && scheme !== "mysql") {
      return null;
    }
    if (!url.hostname || !url.pathname || !url.username) {
      return null;
    }

    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    if (!database) return null;

    const defaultPort = scheme === "postgresql" ? 5432 : 3306;
    const parsedPort = Number(url.port || defaultPort);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      return null;
    }

    return {
      type: scheme,
      host: url.hostname,
      port: parsedPort,
      database,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl:
        scheme === "postgresql"
          ? ["1", "true", "require", "verify-ca", "verify-full"].includes(
            (url.searchParams.get("sslmode") || url.searchParams.get("ssl") || "").toLowerCase()
          )
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 解析 AI 思考过程标签
 */
export function parseThinkContent(
  raw: string
): { thinking: string; content: string; isThinking: boolean } {
  const openTag = "<think>";
  const closeTag = "</think>";

  const openIdx = raw.indexOf(openTag);
  const closeIdx = raw.indexOf(closeTag);

  if (openIdx === -1) {
    return { thinking: "", content: raw, isThinking: false };
  }

  if (closeIdx !== -1 && closeIdx > openIdx) {
    const thinking = raw.slice(openIdx + openTag.length, closeIdx).trim();
    const content = raw.slice(0, openIdx) + raw.slice(closeIdx + closeTag.length);
    return { thinking, content: content.trim() || "", isThinking: false };
  }

  // 未闭合的标签，流式中间态
  const thinking = raw.slice(openIdx + openTag.length).trim();
  const content = raw.slice(0, openIdx);
  return { thinking, content, isThinking: true };
}
