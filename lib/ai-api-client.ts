/**
 * AI 发现和大屏功能 API 客户端
 */

import type {
  AIFinding,
  AIFindingStats,
  DashboardConfigBackend,
  DashboardWidget,
  LayoutSuggestions,
  SemanticModelCache,
} from './types';

const API_BASE = '/api';

/**
 * 通用请求处理
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============ AI 发现相关 API ============

/**
 * 获取数据源的 AI 发现列表
 */
export async function getAIFindings(
  tenantId: string,
  dataSourceId: string,
  type?: string
): Promise<AIFinding[]> {
  const url = new URL(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/ai-findings`,
    window.location.origin
  );
  if (type) {
    url.searchParams.set('type', type);
  }
  return request<AIFinding[]>(url.toString());
}

/**
 * 获取 AI 发现统计
 */
export async function getAIFindingStats(
  tenantId: string,
  dataSourceId: string
): Promise<AIFindingStats> {
  return request<AIFindingStats>(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/ai-findings/stats`
  );
}

/**
 * 获取 AI 洞察摘要
 */
export async function getAIInsightSummary(
  tenantId: string,
  dataSourceId: string
): Promise<string> {
  const response = await fetch(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/ai-findings/summary`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * 触发重新发现
 */
export async function triggerRediscovery(
  tenantId: string,
  dataSourceId: string
): Promise<void> {
  await request(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/ai-findings/rediscover`,
    {
      method: 'POST',
    }
  );
}

/**
 * 删除 AI 发现
 */
export async function deleteAIFinding(
  tenantId: string,
  findingId: string
): Promise<void> {
  await request(`${API_BASE}/tenants/${tenantId}/ai-findings/${findingId}`, {
    method: 'DELETE',
  });
}

// ============ 语义模型相关 API ============

/**
 * 构建语义模型缓存
 */
export async function buildSemanticModel(
  tenantId: string,
  dataSourceId: string
): Promise<void> {
  await request(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/semantic-model/build`,
    {
      method: 'POST',
    }
  );
}

/**
 * 获取语义模型缓存
 */
export async function getSemanticModel(
  tenantId: string,
  dataSourceId: string
): Promise<SemanticModelCache> {
  return request<SemanticModelCache>(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/semantic-model`
  );
}

/**
 * 获取语义上下文
 */
export async function getSemanticContext(
  tenantId: string,
  dataSourceId: string
): Promise<string> {
  const response = await fetch(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/semantic-model/context`
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

/**
 * 刷新语义模型
 */
export async function refreshSemanticModel(
  tenantId: string,
  dataSourceId: string
): Promise<void> {
  await request(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/semantic-model/refresh`,
    {
      method: 'POST',
    }
  );
}

/**
 * 自然语言转 SQL
 */
export async function nl2sql(
  tenantId: string,
  dataSourceId: string,
  query: string
): Promise<{ sql: string }> {
  return request<{ sql: string }>(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/semantic-model/nl2sql`,
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    }
  );
}

// ============ 大屏相关 API ============

/**
 * 获取大屏列表
 */
export async function getDashboards(
  tenantId: string,
  dataSourceId?: string
): Promise<DashboardConfigBackend[]> {
  const url = new URL(
    `${API_BASE}/tenants/${tenantId}/dashboards`,
    window.location.origin
  );
  if (dataSourceId) {
    url.searchParams.set('dataSourceId', dataSourceId);
  }
  return request<DashboardConfigBackend[]>(url.toString());
}

/**
 * 获取单个大屏
 */
export async function getDashboard(
  tenantId: string,
  dashboardId: string
): Promise<DashboardConfigBackend> {
  return request<DashboardConfigBackend>(
    `${API_BASE}/tenants/${tenantId}/dashboards/${dashboardId}`
  );
}

/**
 * 创建大屏（自动生成）
 */
export async function createAutoDashboard(
  tenantId: string,
  dataSourceId: string,
  name?: string
): Promise<DashboardConfigBackend> {
  return request<DashboardConfigBackend>(
    `${API_BASE}/tenants/${tenantId}/dashboards`,
    {
      method: 'POST',
      body: JSON.stringify({
        dataSourceId,
        name: name || '',
      }),
    }
  );
}

/**
 * 更新大屏
 */
export async function updateDashboard(
  tenantId: string,
  dashboardId: string,
  updates: Partial<{
    name: string;
    description: string;
    layoutType: string;
    widgets: string;
    storyOrder: string;
    theme: string;
  }>
): Promise<DashboardConfigBackend> {
  return request<DashboardConfigBackend>(
    `${API_BASE}/tenants/${tenantId}/dashboards/${dashboardId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );
}

/**
 * 删除大屏
 */
export async function deleteDashboard(
  tenantId: string,
  dashboardId: string
): Promise<void> {
  await request(`${API_BASE}/tenants/${tenantId}/dashboards/${dashboardId}`, {
    method: 'DELETE',
  });
}

/**
 * 重新生成大屏
 */
export async function regenerateDashboard(
  tenantId: string,
  dashboardId: string
): Promise<DashboardConfigBackend> {
  return request<DashboardConfigBackend>(
    `${API_BASE}/tenants/${tenantId}/dashboards/${dashboardId}/regenerate`,
    {
      method: 'POST',
    }
  );
}

/**
 * 获取大屏预览数据
 */
export async function getDashboardPreview(
  tenantId: string,
  dashboardId: string
): Promise<{
  widgets: { widgetId: string; data: any[] }[];
}> {
  return request<{ widgets: { widgetId: string; data: any[] }[] }>(
    `${API_BASE}/tenants/${tenantId}/dashboards/${dashboardId}/preview`
  );
}

/**
 * 获取布局建议
 */
export async function getLayoutSuggestions(
  tenantId: string,
  dataSourceId: string
): Promise<LayoutSuggestions> {
  return request<LayoutSuggestions>(
    `${API_BASE}/tenants/${tenantId}/data-sources/${dataSourceId}/dashboards/suggestions`
  );
}

/**
 * 解析大屏组件
 */
export function parseDashboardWidgets(
  dashboard: DashboardConfigBackend
): DashboardWidget[] {
  if (!dashboard.widgets) {
    return [];
  }
  try {
    return JSON.parse(dashboard.widgets);
  } catch (e) {
    console.error('Failed to parse dashboard widgets:', e);
    return [];
  }
}

/**
 * 解析故事线顺序
 */
export function parseStoryOrder(dashboard: DashboardConfigBackend): string[] {
  if (!dashboard.storyOrder) {
    return [];
  }
  try {
    return JSON.parse(dashboard.storyOrder);
  } catch (e) {
    console.error('Failed to parse story order:', e);
    return [];
  }
}
