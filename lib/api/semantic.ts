import type {
  Metric,
  Dimension,
  Relationship,
  SemanticSummary,
  AutoDiscoverResult,
} from '@/lib/types/semantic';

const API_BASE = '/api/tenants';

export async function getTenantId(): Promise<string> {
  // 从 localStorage 或上下文获取当前租户 ID
  const tenant = localStorage.getItem('currentTenant');
  return tenant || 'default';
}

// ==================== Metrics ====================

export async function listMetrics(category?: string, status?: string): Promise<Metric[]> {
  const tenantId = await getTenantId();
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (status) params.append('status', status);
  
  const response = await fetch(`${API_BASE}/${tenantId}/metrics?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch metrics');
  const data = await response.json();
  return data.metrics || [];
}

export async function getMetric(metricId: string): Promise<Metric> {
  const tenantId = await getTenantId();
  const response = await fetch(`${API_BASE}/${tenantId}/metrics/${metricId}`);
  if (!response.ok) throw new Error('Failed to fetch metric');
  const data = await response.json();
  return data.metric;
}

export async function createMetric(metric: Partial<Metric>): Promise<Metric> {
  const tenantId = await getTenantId();
  const response = await fetch(`${API_BASE}/${tenantId}/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  });
  if (!response.ok) throw new Error('Failed to create metric');
  const data = await response.json();
  return data.metric;
}

export async function updateMetric(metricId: string, updates: Partial<Metric>): Promise<Metric> {
  const tenantId = await getTenantId();
  const response = await fetch(`${API_BASE}/${tenantId}/metrics/${metricId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update metric');
  const data = await response.json();
  return data.metric;
}

export async function deleteMetric(metricId: string): Promise<void> {
  const tenantId = await getTenantId();
  const response = await fetch(`${API_BASE}/${tenantId}/metrics/${metricId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete metric');
}

export async function autoDiscoverMetrics(dataSourceId: string): Promise<AutoDiscoverResult<Metric>> {
  const tenantId = await getTenantId();
  const response = await fetch(
    `${API_BASE}/${tenantId}/metrics/auto-discover?dataSourceId=${dataSourceId}`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error('Failed to auto-discover metrics');
  return response.json();
}

export async function confirmMetrics(metricIds: string[]): Promise<void> {
  const tenantId = await getTenantId();
  const response = await fetch(`${API_BASE}/${tenantId}/metrics/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metricIds }),
  });
  if (!response.ok) throw new Error('Failed to confirm metrics');
}

export async function getSemanticSummary(): Promise<SemanticSummary> {
  const tenantId = await getTenantId();
  const response = await fetch(`${API_BASE}/${tenantId}/semantic/summary`);
  if (!response.ok) throw new Error('Failed to fetch semantic summary');
  return response.json();
}

// ==================== Dimensions ====================

export async function autoDiscoverDimensions(dataSourceId: string): Promise<AutoDiscoverResult<Dimension>> {
  const tenantId = await getTenantId();
  const response = await fetch(
    `${API_BASE}/${tenantId}/dimensions/auto-discover?dataSourceId=${dataSourceId}`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error('Failed to auto-discover dimensions');
  return response.json();
}

// ==================== Relationships ====================

export async function autoDiscoverRelationships(dataSourceId: string): Promise<AutoDiscoverResult<Relationship>> {
  const tenantId = await getTenantId();
  const response = await fetch(
    `${API_BASE}/${tenantId}/relationships/auto-discover?dataSourceId=${dataSourceId}`,
    { method: 'POST' }
  );
  if (!response.ok) throw new Error('Failed to auto-discover relationships');
  return response.json();
}
