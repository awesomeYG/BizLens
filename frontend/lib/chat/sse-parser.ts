/**
 * SSE (Server-Sent Events) 流式响应解析器
 * 提供健壮的流式数据解析能力，支持分块传输和错误恢复
 */

import type { SSEEvent } from "./types";

/**
 * SSE 事件解析结果
 */
export interface SSEParseResult {
  event: SSEEvent;
  raw?: string;
}

/**
 * SSE 流式解析器类
 * 支持增量式解析，可以处理分块传输和不完整的 SSE 事件
 */
export class SSEParser {
  private buffer: string = "";

  /**
   * 追加数据到缓冲区
   */
  append(chunk: string): void {
    this.buffer += chunk;
  }

  /**
   * 获取缓冲区内容
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = "";
  }

  /**
   * 解析所有可用的完整事件
   * @returns 解析出的事件数组
   */
  parseEvents(): SSEParseResult[] {
    const results: SSEParseResult[] = [];
    let idx: number;

    // 按 SSE 分隔符 "\n\n" 分割
    while ((idx = this.buffer.indexOf("\n\n")) !== -1) {
      const raw = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 2);

      if (!raw) continue;

      // 处理多行 SSE 数据（data: line1\ndata: line2\n\n）
      const lines = raw.split("\n");
      let dataLine = "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          const value = trimmed.slice(5).trim();
          dataLine += (dataLine ? "\n" : "") + value;
        }
      }

      if (!dataLine) continue;

      try {
        const event = JSON.parse(dataLine) as SSEEvent;
        results.push({ event, raw });
      } catch {
        // JSON 解析失败，忽略该事件
        results.push({ event: { type: "error", error: "Invalid JSON in SSE data" }, raw });
      }
    }

    return results;
  }

  /**
   * 解析单条 SSE 事件字符串
   * @param raw 原始 SSE 数据行
   * @returns 解析结果或 null
   */
  static parseSingle(raw: string): SSEParseResult | null {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("data:")) return null;

    const dataStr = trimmed.slice(5).trim();
    if (!dataStr) return null;

    try {
      const event = JSON.parse(dataStr) as SSEEvent;
      return { event, raw };
    } catch {
      return { event: { type: "error", error: "Invalid JSON" }, raw };
    }
  }

  /**
   * 从 ReadableStream 读取并解析 SSE 事件
   * @param reader 流读取器
   * @param onEvent 事件回调
   * @param signal 中止信号
   */
  static async streamFromReader(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const decoder = new TextDecoder();
    const parser = new SSEParser();
    let fullContent = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (signal?.aborted) break;

        parser.append(decoder.decode(value, { stream: true }));
        const events = parser.parseEvents();

        for (const { event } of events) {
          if (signal?.aborted) break;

          if (event.type === "delta") {
            fullContent += event.content || "";
          }
          onEvent(event);
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }

  /**
   * 解析 SSE 分隔符（兼容处理没有明确分隔的情况）
   */
  static extractEventsFromBuffer(buffer: string): { events: SSEParseResult[]; remaining: string } {
    const results: SSEParseResult[] = [];
    let remaining = buffer;

    // 尝试按 "\n\n" 分割
    const parts = remaining.split(/\n\n/);
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      const result = SSEParser.parseSingle(part);
      if (result) results.push(result);
    }

    // 保留最后一个可能不完整的部分
    remaining = parts[parts.length - 1];

    return { events: results, remaining };
  }
}

/**
 * 便捷函数：从 fetch 响应中解析 SSE 事件
 */
export async function parseSSEStream(
  response: Response,
  callbacks: {
    onDelta?: (content: string) => void;
    onMeta?: (data: { analysis?: unknown; model?: string; autoQueryData?: unknown }) => void;
    onToolCall?: (data: { toolName?: string; toolCallId?: string }) => void;
    onToolResult?: (data: { toolCallId?: string; result?: { success?: boolean; message?: string } }) => void;
    onDone?: () => void;
    onError?: (error: string) => void;
  },
  signal?: AbortSignal
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body reader");

  const decoder = new TextDecoder();
  const parser = new SSEParser();
  let fullContent = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal?.aborted) break;

      parser.append(decoder.decode(value, { stream: true }));
      const events = parser.parseEvents();

      for (const { event } of events) {
        switch (event.type) {
          case "delta":
            fullContent += event.content || "";
            callbacks.onDelta?.(event.content || "");
            break;
          case "meta":
            callbacks.onMeta?.(event);
            break;
          case "tool_call":
            callbacks.onToolCall?.(event);
            break;
          case "tool_result":
            callbacks.onToolResult?.(event);
            break;
          case "done":
            callbacks.onDone?.();
            break;
          case "error":
            callbacks.onError?.(event.error || "Unknown error");
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}
