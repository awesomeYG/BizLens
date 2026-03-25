"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/auth/api";

interface FieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  statistics?: {
    nullCount: number;
    nullRatio: number;
    uniqueCount: number;
    topValues?: { value: string; count: number }[];
  };
}

interface QualityIssue {
  id: string;
  ruleId: string;
  ruleName: string;
  fieldName: string;
  severity: "high" | "medium" | "low";
  message: string;
  suggestion?: string;
  affectedRatio?: number;
}

interface CleanOperation {
  type: string;
  name: string;
  description: string;
}

interface CleanResult {
  success: boolean;
  operation: string;
  modifiedRows: number;
  before?: string;
  after?: string;
}

function DataCleanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset");

  const [dataset, setDataset] = useState<any>(null);
  const [schema, setSchema] = useState<FieldInfo[]>([]);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [availableOps, setAvailableOps] = useState<CleanOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState<CleanResult[]>([]);
  const [activeTab, setActiveTab] = useState<"issues" | "clean" | "preview">("issues");

  // 加载数据集信息
  useEffect(() => {
    if (!datasetId) return;

    const loadData = async () => {
      try {
        const token = getAccessToken();
        const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [dsRes, previewRes] = await Promise.all([
          fetch(`/api/datasets/${datasetId}`, {
            headers: authHeaders,
          }),
          fetch(`/api/datasets/${datasetId}/preview?limit=20`, {
            headers: authHeaders,
          }),
        ]);

        if (dsRes.ok) {
          const ds = await dsRes.json();
          setDataset(ds);
          if (ds.schema) {
            const schemaData = JSON.parse(ds.schema);
            setSchema(schemaData.fields || []);
          }
        }

        if (previewRes.ok) {
          const preview = await previewRes.json();
          setPreviewData(preview.data || []);
        }
      } catch (error) {
        console.error("加载数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [datasetId]);

  // 加载质量问题
  useEffect(() => {
    if (!datasetId) return;

    const loadIssues = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(`/api/datasets/${datasetId}/quality`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setIssues(data);
        }
      } catch (error) {
        console.error("加载质量问题失败:", error);
      }
    };

    loadIssues();
  }, [datasetId]);

  // 选择字段时获取可用的清洗操作
  const handleFieldSelect = useCallback(async (field: FieldInfo) => {
    setSelectedField(field.name);
    setSelectedIssue(null);

    // 构建样本值
    const samples: string[] = [];
    previewData.forEach((row: any[]) => {
      const idx = schema.findIndex((s) => s.name === field.name);
      if (idx >= 0 && row[idx]) {
        samples.push(String(row[idx]).slice(0, 50));
      }
    });

    try {
      const token = getAccessToken();
      const params = new URLSearchParams({
        field: field.name,
        type: field.type,
        samples: samples.slice(0, 10).join(","),
      });

      const res = await fetch(`/api/datasets/${datasetId}/clean/operations?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        setAvailableOps(data.operations || []);
      }
    } catch (error) {
      console.error("加载清洗操作失败:", error);
    }
  }, [datasetId, previewData, schema]);

  // 处理问题点击
  const handleIssueClick = useCallback((issue: QualityIssue) => {
    setSelectedIssue(issue.id);
    setActiveTab("clean");
    
    // 自动选中相关字段
    const field = schema.find((s) => s.name === issue.fieldName);
    if (field) {
      handleFieldSelect(field);
    }
  }, [schema, handleFieldSelect]);

  // 执行清洗操作
  const executeClean = async (operation: CleanOperation) => {
    if (!selectedField) return;

    setCleaning(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/datasets/${datasetId}/clean`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: operation.type,
          field: selectedField,
          options: {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setResults((prev) => [
            ...prev,
            {
              success: true,
              operation: operation.name,
              modifiedRows: data.modifiedRows || 0,
              before: data.before,
              after: data.after,
            },
          ]);
        }
      }
    } catch (error) {
      console.error("清洗失败:", error);
    } finally {
      setCleaning(false);
    }
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-red-400 bg-red-500/10";
      case "medium":
        return "text-amber-400 bg-amber-500/10";
      case "low":
        return "text-blue-400 bg-blue-500/10";
      default:
        return "text-zinc-400 bg-zinc-500/10";
    }
  };

  // 获取类型颜色
  const getTypeColor = (type: string) => {
    switch (type) {
      case "string":
        return "text-emerald-400";
      case "integer":
      case "float":
        return "text-blue-400";
      case "date":
      case "datetime":
        return "text-purple-400";
      case "boolean":
        return "text-amber-400";
      default:
        return "text-zinc-400";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-zinc-900 bg-zinc-950/40">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/settings/data-sources?tab=files")}
            className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="text-sm">返回数据源</span>
          </button>
          <div className="hidden h-6 w-px bg-zinc-800 sm:block" />
          <h1 className="text-lg font-semibold text-zinc-100">数据清洗向导</h1>
        </div>
        <div className="text-sm text-zinc-500">{dataset?.name || "数据集"}</div>
      </div>

      <main className="max-w-7xl">
        {/* 数据集概览 */}
        <div className="grid sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">数据行数</p>
            <p className="text-2xl font-bold text-zinc-100">
              {(dataset?.rowCount || 0).toLocaleString()}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">字段数量</p>
            <p className="text-2xl font-bold text-zinc-100">
              {schema.length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">质量问题</p>
            <p className="text-2xl font-bold text-amber-400">
              {issues.length}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">清洗记录</p>
            <p className="text-2xl font-bold text-emerald-400">
              {results.length}
            </p>
          </div>
        </div>

        {/* 标签切换 */}
        <div className="flex gap-4 mb-6 border-b border-zinc-800/50">
          <button
            onClick={() => setActiveTab("issues")}
            className={`pb-3 px-2 text-sm font-medium transition-all ${
              activeTab === "issues"
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            数据问题 ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab("clean")}
            className={`pb-3 px-2 text-sm font-medium transition-all ${
              activeTab === "clean"
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            清洗操作
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`pb-3 px-2 text-sm font-medium transition-all ${
              activeTab === "preview"
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            数据预览
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左侧：字段列表 */}
          <div className="lg:col-span-1">
            <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">数据字段</h3>
              <div className="space-y-2">
                {schema.map((field, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleFieldSelect(field)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedField === field.name
                        ? "bg-indigo-500/10 border border-indigo-500/30"
                        : "bg-zinc-800/30 border border-transparent hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-200">
                        {field.name}
                      </span>
                      <span className={`text-xs ${getTypeColor(field.type)}`}>
                        {field.type}
                      </span>
                    </div>
                    {field.statistics && (
                      <div className="flex gap-3 text-xs text-zinc-500">
                        {field.statistics.nullCount > 0 && (
                          <span className="text-amber-400">
                            空值 {field.statistics.nullCount}
                          </span>
                        )}
                        <span>
                          唯一值 {field.statistics.uniqueCount}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：内容区域 */}
          <div className="lg:col-span-2">
            {activeTab === "issues" && (
              /* 问题列表 */
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">数据质量问题</h3>
                {issues.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <p className="text-zinc-400 mb-2">数据质量良好</p>
                    <p className="text-xs text-zinc-600">
                      没有发现需要处理的数据问题
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issues.map((issue) => (
                      <button
                        key={issue.id}
                        onClick={() => handleIssueClick(issue)}
                        className={`w-full p-4 rounded-lg text-left transition-all border ${
                          selectedIssue === issue.id
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-zinc-800/30 border-transparent hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                              issue.severity
                            )}`}
                          >
                            {issue.severity === "high"
                              ? "高"
                              : issue.severity === "medium"
                              ? "中"
                              : "低"}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-zinc-200 mb-1">
                              {issue.ruleName} - {issue.fieldName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {issue.message}
                            </p>
                            {issue.suggestion && (
                              <p className="text-xs text-indigo-400 mt-2">
                                建议: {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "clean" && (
              /* 清洗操作 */
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">
                  {selectedField ? `清洗: ${selectedField}` : "选择要清洗的字段"}
                </h3>

                {!selectedField ? (
                  <div className="text-center py-12">
                    <p className="text-zinc-500">
                      请从左侧选择一个字段来查看可用的清洗操作
                    </p>
                  </div>
                ) : availableOps.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-zinc-500">
                      该字段没有可用的清洗操作
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableOps.map((op) => (
                      <div
                        key={op.type}
                        className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-800/50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-medium text-zinc-200">
                              {op.name}
                            </h4>
                            <p className="text-xs text-zinc-500 mt-1">
                              {op.description}
                            </p>
                          </div>
                          <button
                            onClick={() => executeClean(op)}
                            disabled={cleaning}
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-40"
                          >
                            {cleaning ? "执行中..." : "执行"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 清洗结果 */}
                {results.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-300 mb-4">清洗结果</h4>
                    <div className="space-y-2">
                      {results.map((result, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 text-emerald-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m4.5 12.75 6 6 9-13.5"
                              />
                            </svg>
                            <span className="text-sm text-zinc-200">
                              {result.operation}
                            </span>
                            <span className="text-xs text-zinc-500">
                              影响 {result.modifiedRows} 行
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "preview" && (
              /* 数据预览 */
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">数据预览（前 20 行）</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800/50">
                        {schema.map((field, idx) => (
                          <th
                            key={idx}
                            className="text-left px-3 py-2 text-xs font-medium text-zinc-500 uppercase"
                          >
                            {field.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {previewData.map((row: any[], rowIdx: number) => (
                        <tr key={rowIdx} className="hover:bg-zinc-800/20">
                          {schema.map((field, colIdx) => (
                            <td
                              key={colIdx}
                              className="px-3 py-2 text-zinc-300"
                            >
                              {row[colIdx] ?? "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DataCleanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-zinc-900 bg-zinc-950/40">
          <div className="text-zinc-400">加载中...</div>
        </div>
      }
    >
      <DataCleanPageContent />
    </Suspense>
  );
}
