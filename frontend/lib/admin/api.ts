import type { ActivateResponse, Tokens, User } from "@/lib/types";
import { getAccessToken, getRefreshToken, request } from "@/lib/auth/api";

export interface AdminStatsResponse {
  totalUsers: number;
  totalDatasets: number;
  totalDataSources: number;
  totalStorageSize: number;
  storageByFormat: Record<string, number>;
  recentDatasets: Array<{
    id: string;
    name: string;
    fileName: string;
    fileSize: number;
    fileFormat: string;
    createdAt: string;
  }>;
}

export const adminApi = {
  getStats: () => request<AdminStatsResponse>("/admin/stats"),

  listUsers: (params?: Record<string, string>) =>
    request(`/admin/users?${new URLSearchParams(params || {}).toString()}`),
  createUser: (data: { name: string; email: string; password: string; role: string }) =>
    request(`/admin/users`, { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: { name?: string; role?: string }) =>
    request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) => request(`/admin/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id: string) =>
    request(`/admin/users/${id}/reset-password`, { method: "POST" }),
  toggleUserStatus: (id: string) => request(`/admin/users/${id}/toggle`, { method: "POST" }),

  listDatasets: (params?: Record<string, string>) =>
    request(`/admin/datasets?${new URLSearchParams(params || {}).toString()}`),
  deleteDataset: (id: string) => request(`/admin/datasets/${id}`, { method: "DELETE" }),

  listDataSources: (params?: Record<string, string>) =>
    request(`/admin/data-sources?${new URLSearchParams(params || {}).toString()}`),
  testDataSource: (id: string) => request(`/admin/data-sources/${id}/test`, { method: "POST" }),
  deleteDataSource: (id: string) => request(`/admin/data-sources/${id}`, { method: "DELETE" }),
};
