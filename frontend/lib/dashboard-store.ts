"use client";

import { request } from "./auth/api";
import { getCurrentUser } from "./user-store";
import type { DashboardSection, DashboardTemplateId } from "./types";

interface DashboardInstanceDTO {
  id: string;
  templateId?: string;
  tenantId?: string;
  name: string;
  description?: string;
  layoutConfig?: string;
  colorPalette?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DashboardSectionPayload {
  sections: DashboardSection[];
  title?: string;
  version?: number;
}

export interface DashboardInstanceView {
  id: string;
  title: string;
  templateId: DashboardTemplateId | string;
  sections: DashboardSection[];
  createdAt: number;
  updatedAt: number;
}

function getTenantId(): string {
  const user = getCurrentUser();
  return user?.tenantId || user?.id || "demo-tenant";
}

function parseSections(layoutConfig?: string): DashboardSection[] {
  if (!layoutConfig) return [];
  try {
    const parsed = JSON.parse(layoutConfig) as Partial<DashboardSectionPayload>;
    if (Array.isArray(parsed.sections)) return parsed.sections;
    if (parsed && typeof parsed === "object" && "sections" in parsed && Array.isArray((parsed as any).sections)) {
      return (parsed as any).sections as DashboardSection[];
    }
  } catch {
    // ignore
  }
  return [];
}

function toView(dto: DashboardInstanceDTO): DashboardInstanceView {
  return {
    id: dto.id,
    title: dto.name || "AI 数据大屏",
    templateId: (dto.templateId as DashboardTemplateId) || "custom",
    sections: parseSections(dto.layoutConfig),
    createdAt: dto.createdAt ? new Date(dto.createdAt).getTime() : Date.now(),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt).getTime() : Date.now(),
  };
}

/** 获取当前租户的大屏实例列表 */
export async function listDashboards(): Promise<DashboardInstanceView[]> {
  const tenantId = getTenantId();
  const res = await request<{ instances: DashboardInstanceDTO[] }>(`/tenants/${tenantId}/dashboards/instances`);
  return (res.instances || []).map(toView);
}

/** 获取单个大屏实例 */
export async function getDashboard(id: string): Promise<DashboardInstanceView | null> {
  const tenantId = getTenantId();
  try {
    const res = await request<{ instance: DashboardInstanceDTO }>(`/tenants/${tenantId}/dashboards/instances/${id}`);
    return res.instance ? toView(res.instance) : null;
  } catch {
    return null;
  }
}

/**
 * 创建大屏实例并写入 sections（布局配置存储于 layoutConfig）
 */
export async function createDashboardInstance(params: {
  title: string;
  description?: string;
  templateId?: string;
  dataSourceId?: string;
  sections: DashboardSection[];
}): Promise<DashboardInstanceView> {
  const tenantId = getTenantId();
  const payload = {
    templateId: params.templateId || "custom",
    dataSourceId: params.dataSourceId || "",
    name: params.title,
    description: params.description || "",
  };
  const created = await request<{ instance: DashboardInstanceDTO }>(
    `/tenants/${tenantId}/dashboards/instances`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  // 将 sections 序列化存入 layoutConfig，便于前端直接渲染
  const layoutConfig: DashboardSectionPayload = {
    sections: params.sections,
    title: params.title,
    version: 1,
  };
  await request(`/tenants/${tenantId}/dashboards/instances/${created.instance.id}`, {
    method: "PUT",
    body: JSON.stringify({ layoutConfig: JSON.stringify(layoutConfig) }),
  });

  return toView({ ...created.instance, layoutConfig: JSON.stringify(layoutConfig) });
}

/** 删除实例 */
export async function deleteDashboard(id: string): Promise<void> {
  const tenantId = getTenantId();
  await request(`/tenants/${tenantId}/dashboards/instances/${id}`, { method: "DELETE" });
}
