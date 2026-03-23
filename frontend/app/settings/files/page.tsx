"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface UploadedFile {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileFormat: string;
  status: string;
  rowCount: number;
  columnCount: number;
  qualityScore: number;
  createdAt: string;
  updatedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(format: string): string {
  const iconMap: Record<string, string> = {
    csv: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
    xlsx: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
    xls: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
    json: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 12l-2 2 2 2 M15 12l2 2-2 2",
    xml: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h2 M14 13h2 M8 17h2 M14 17h2",
  };
  return iconMap[format.toLowerCase()] || "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6";
}

function getQualityColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function getQualityBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-rose-500";
}

function getFormatTagClass(format: string): string {
  const formatClassMap: Record<string, string> = {
    csv: "border-emerald-200 bg-emerald-50 text-emerald-700",
    xlsx: "border-blue-200 bg-blue-50 text-blue-700",
    xls: "border-sky-200 bg-sky-50 text-sky-700",
    json: "border-violet-200 bg-violet-50 text-violet-700",
    xml: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return formatClassMap[format.toLowerCase()] ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function getStatusTag(status: string): { text: string; className: string } {
  const normalizedStatus = status.toLowerCase();
  if (["ready", "active", "completed", "available", "success"].includes(normalizedStatus)) {
    return {
      text: "可用",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (["processing", "pending", "parsing", "uploading"].includes(normalizedStatus)) {
    return {
      text: "处理中",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (["failed", "error", "invalid"].includes(normalizedStatus)) {
    return {
      text: "异常",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    text: status || "未知",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

export default function FilesSettingsPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", "100");

      const response = await fetch(`/api/datasets?${params.toString()}`);
      const result = await response.json();
      setFiles(result.data || []);
    } catch (err) {
      console.error("获取文件列表失败:", err);
      setMessage({ type: "error", text: "获取文件列表失败，请刷新重试" });
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    const allowedExtensions = [".xlsx", ".xls", ".csv", ".json", ".xml"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      setMessage({ type: "error", text: "不支持的文件格式，请上传 xlsx、xls、csv、json 或 xml 文件" });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setMessage({ type: "error", text: "文件大小不能超过 100MB" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch("/api/datasets/upload/file", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "上传失败");
      }

      const result = await response.json();

      // 添加到列表
      setFiles((prev) => [result.dataset, ...prev]);
      setMessage({ type: "success", text: `文件 "${file.name}" 上传成功！` });

      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "上传失败，请重试" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/datasets?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("删除失败");
      }

      setFiles((prev) => prev.filter((f) => f.id !== id));
      setMessage({ type: "success", text: "文件已删除" });
    } catch {
      setMessage({ type: "error", text: "删除失败，请重试" });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const filteredFiles = files.filter((file) => {
    if (selectedFormat !== "all" && file.fileFormat.toLowerCase() !== selectedFormat) {
      return false;
    }
    return true;
  });

  const formats = ["all", ...Array.from(new Set(files.map((f) => f.fileFormat.toLowerCase())))];
  const totalFileSize = files.reduce((total, file) => total + file.fileSize, 0);
  const averageQuality = files.filter((file) => file.qualityScore > 0).reduce((sum, file, _, arr) => {
    return sum + file.qualityScore / arr.length;
  }, 0);
  const qualityKnownCount = files.filter((file) => file.qualityScore > 0).length;
  const processingCount = files.filter((file) => {
    const normalizedStatus = file.status.toLowerCase();
    return ["processing", "pending", "parsing", "uploading"].includes(normalizedStatus);
  }).length;

  return (
    <div>
      <main className="mx-auto max-w-6xl py-2">
        {/* 页面标题 */}
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                文件管理
              </div>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">管理你的数据文件资产</h2>
              <p className="mt-2 text-slate-600">支持上传、检索、质量查看与删除，文件可直接用于后续 AI 分析。</p>
            </div>
            <Link
              href="/settings/ai"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              去配置 AI 服务
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-slate-500">文件总数</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{files.length}</p>
            <p className="mt-1 text-xs text-slate-500">当前筛选结果 {filteredFiles.length} 个</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-slate-500">总存储体积</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatFileSize(totalFileSize)}</p>
            <p className="mt-1 text-xs text-slate-500">单文件上限 100 MB</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-slate-500">平均质量评分</p>
            <p className={`mt-2 text-2xl font-semibold ${averageQuality ? getQualityColor(averageQuality) : "text-slate-900"}`}>
              {averageQuality ? `${Math.round(averageQuality)}%` : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-500">已分析文件 {qualityKnownCount} 个</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-slate-500">处理中任务</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{processingCount}</p>
            <p className="mt-1 text-xs text-slate-500">等待解析或入库的文件</p>
          </div>
        </div>

        {/* 上传区域 */}
        <button
          type="button"
          onClick={() => {
            if (!uploading) fileInputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if (uploading) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`mb-8 rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
            dragActive
              ? "scale-[1.01] border-blue-500 bg-blue-50/70 shadow-md"
              : "border-slate-300 bg-white/90 hover:border-slate-400 hover:shadow-sm"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {uploading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium text-slate-700">正在上传并校验文件...</span>
              </div>
              <div className="mx-auto h-2 w-full max-w-md rounded-full bg-slate-200">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-slate-500">{uploadProgress}%</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>
              <p className="mb-2 text-lg font-semibold text-slate-800">
                拖拽文件到此处，或 <span className="text-blue-600">点击上传</span>
              </p>
              <p className="mb-4 text-sm text-slate-500">
                支持 xlsx、xls、csv、json、xml 格式，文件大小不超过 100MB
              </p>
              <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1">自动识别列类型</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">质量评分</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">结构化入库</span>
              </div>
              <input
                id="upload-file-input"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json,.xml"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700 hover:shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                选择文件
              </span>
            </>
          )}
        </button>

        {/* 消息提示 */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* 筛选和搜索 */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">文件列表</p>
              <p className="text-xs text-slate-500">支持按名称检索与格式筛选</p>
            </div>
            <button
              type="button"
              onClick={fetchFiles}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新列表
            </button>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedFormat === format
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {format === "all" ? "全部" : format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        </div>

        {/* 文件列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-12 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无文件</h3>
            <p className="text-gray-500">
              {searchQuery ? "没有找到匹配的文件" : "上传您的第一个数据文件开始使用"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">文件信息</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">格式</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">大小</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">数据量</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">质量</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">状态</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">上传时间</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredFiles.map((file) => (
                    <tr key={file.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d={getFileIcon(file.fileFormat)} />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[200px]">{file.name}</p>
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">{file.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${getFormatTagClass(file.fileFormat)}`}>
                          {file.fileFormat.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatFileSize(file.fileSize)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {file.rowCount > 0 ? (
                          <span>{file.rowCount.toLocaleString()} 行 × {file.columnCount} 列</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {file.qualityScore > 0 ? (
                          <div className="min-w-[120px]">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className={`font-medium ${getQualityColor(file.qualityScore)}`}>{file.qualityScore}%</span>
                              <span className="text-slate-400">质量</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-200">
                              <div
                                className={`h-1.5 rounded-full ${getQualityBarColor(file.qualityScore)}`}
                                style={{ width: `${file.qualityScore}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusTag(file.status).className}`}>
                          {getStatusTag(file.status).text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(file.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDeleteConfirm(file.id)}
                            className="rounded-lg p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
                            title="删除文件"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
              </div>
              <p className="text-gray-600 mb-6">
                确定要删除文件 &quot;{files.find((f) => f.id === deleteConfirm)?.name}&quot; 吗？此操作无法撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
