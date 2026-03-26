// 语义层类型定义（前端专用，与 /workspace/lib/types/semantic.ts 保持同步）

export type MetricDataType = "currency" | "number" | "percentage" | "datetime" | "string";
export type MetricAggregation = "sum" | "count" | "avg" | "min" | "max" | "distinct_count" | "custom";
export type MetricStatus = "active" | "inactive" | "draft";

export interface Metric {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  description?: string;
  dataType: MetricDataType;
  aggregation: MetricAggregation;
  formula: string;
  baseTable: string;
  baseField: string;
  dependentMetrics?: string[];
  tags?: string[];
  category?: string;
  isAutoDetected: boolean;
  confidenceScore: number;
  status: MetricStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutoDiscoverResult<T> {
  items: T[];
  count: number;
}
