// 语义层类型定义

export type MetricDataType = 'currency' | 'number' | 'percentage' | 'datetime' | 'string';
export type MetricAggregation = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct_count' | 'custom';
export type MetricStatus = 'active' | 'inactive' | 'draft';

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

export interface Dimension {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  description?: string;
  dataType: 'time' | 'category' | 'geo' | 'custom';
  baseTable: string;
  baseField: string;
  preValues?: string[];
  isAutoDetected: boolean;
  tags?: string[];
  category?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sourceTable: string;
  targetTable: string;
  relationship: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  joinKey: string;
  targetKey: string;
  isAutoDetected: boolean;
  confidenceScore: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface MetricLineage {
  id: string;
  tenantId: string;
  metricId: string;
  sourceType: 'table' | 'column' | 'metric';
  sourceId: string;
  sourceDetail?: any;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SemanticSummary {
  metrics: {
    total: number;
    active: number;
    draft: number;
  };
  dimensions: {
    total: number;
  };
  relationships: {
    total: number;
  };
  categories: Record<string, number>;
}

export interface AutoDiscoverResult<T> {
  items: T[];
  count: number;
}
