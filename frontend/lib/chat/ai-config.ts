/**
 * AI 配置和模型管理工具
 */

export interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  modelType?: string;
  model?: string;
}

export interface AIModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * 获取模型配置
 */
export function getModelConfig(modelType?: string): AIModelConfig {
  const resolvedModelType = modelType || process.env.AI_MODEL_TYPE || "openai";

  switch (resolvedModelType) {
    case "minimax":
    case "minmax":
      return { model: process.env.MINIMAX_MODEL || "MiniMax-M2", maxTokens: 2000, temperature: 0.7 };
    case "claude":
      return { model: "claude-3-sonnet-20240229", maxTokens: 2000, temperature: 0.7 };
    case "qwen":
      return { model: "qwen-plus", maxTokens: 2000, temperature: 0.7 };
    case "ernie":
      return { model: "ernie-bot-4", maxTokens: 2000, temperature: 0.7 };
    case "deepseek":
      return { model: "deepseek-chat", maxTokens: 2000, temperature: 0.7 };
    default:
      return { model: process.env.OPENAI_MODEL || "gpt-4o-mini", maxTokens: 2000, temperature: 0.7 };
  }
}

/**
 * 获取默认 Base URL
 */
export function getDefaultBaseURL(modelType?: string): string | undefined {
  switch (modelType) {
    case "minimax":
    case "minmax":
      return "https://api.minimax.io/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    default:
      return undefined;
  }
}

/**
 * 合并配置优先级：客户端配置 > 服务端配置 > 环境变量
 */
export function mergeAIConfig(
  clientConfig?: Partial<AIConfig>,
  serverConfig?: Partial<AIConfig>
): {
  apiKey: string | undefined;
  baseUrl: string | undefined;
  modelType: string;
  model: string;
} {
  const modelType = clientConfig?.modelType || serverConfig?.modelType || process.env.AI_MODEL_TYPE || "openai";
  const modelConfig = getModelConfig(modelType);

  return {
    apiKey: clientConfig?.apiKey || serverConfig?.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
    baseUrl: clientConfig?.baseUrl || serverConfig?.baseUrl || process.env.OPENAI_BASE_URL || getDefaultBaseURL(modelType),
    modelType,
    model: clientConfig?.model || serverConfig?.model || modelConfig.model,
  };
}
