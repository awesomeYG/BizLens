export interface SchemaAnalysisTask {
  id: string;
  mode: string;
  status: "pending" | "running" | "succeeded" | "failed";
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface StartSchemaAnalysisResponse {
  success?: boolean;
  existing?: boolean;
  task?: SchemaAnalysisTask;
  message?: string;
  error?: string;
}

interface PollSchemaAnalysisResponse {
  success?: boolean;
  task?: SchemaAnalysisTask;
  error?: string;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startSchemaAnalysisTask(options: {
  tenantId: string;
  dataSourceId: string;
  mode?: "full" | "incremental";
  headers?: HeadersInit;
}): Promise<SchemaAnalysisTask> {
  const response = await fetch(`/api/tenants/${options.tenantId}/data-sources/${options.dataSourceId}/schema/analyze`, {
    method: "POST",
    headers: options.headers,
    body: JSON.stringify({ mode: options.mode ?? "incremental" }),
  });

  const payload = (await response.json().catch(() => ({}))) as StartSchemaAnalysisResponse;
  if (!response.ok || !payload.task) {
    throw new Error(payload.error || payload.message || "启动 AI 分析任务失败");
  }

  return payload.task;
}

export async function waitForSchemaAnalysisTask(options: {
  tenantId: string;
  dataSourceId: string;
  taskId: string;
  headers?: HeadersInit;
  timeoutMs?: number;
  intervalMs?: number;
  onProgress?: (task: SchemaAnalysisTask) => void;
}): Promise<SchemaAnalysisTask> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(
      `/api/tenants/${options.tenantId}/data-sources/${options.dataSourceId}/schema/analyze?taskId=${encodeURIComponent(options.taskId)}`,
      {
        method: "GET",
        headers: options.headers,
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => ({}))) as PollSchemaAnalysisResponse;
    if (!response.ok || !payload.task) {
      throw new Error(payload.error || "获取 AI 分析任务状态失败");
    }

    options.onProgress?.(payload.task);

    if (payload.task.status === "succeeded") {
      return payload.task;
    }
    if (payload.task.status === "failed") {
      throw new Error(payload.task.errorMessage || "AI 分析失败");
    }

    await sleep(intervalMs);
  }

  throw new Error("AI 分析仍在处理中，请稍后刷新查看结果");
}
