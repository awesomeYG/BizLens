import type { AIConfig } from "./types";

const STORAGE_KEY = "ai-bi-ai-config";

const DEFAULT_CONFIG: AIConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

export function getAIConfig(): AIConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return !!config.apiKey.trim();
}
