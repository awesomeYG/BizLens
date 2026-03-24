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
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getQualityBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function getFormatTagClass(format: string): string {
  const formatClassMap: Record<string, string> = {
    csv: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    xlsx: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
    xls: "border-sky-500/20 bg-sky-500/10 text-sky-400",
    json: "border-purple-500/20 bg-purple-500/10 text-purple-400",
    xml: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };
  return formatClassMap[format.toLowerCase()] ?? "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";
}

function getStatusTag(status: string): { text: string; className: string } {
  const normalizedStatus = status.toLowerCase();
  if (["ready", "active", "completed", "available", "success"].includes(normalizedStatus)) {
    return {
      text: "可用",
      className: "badge-success",
    };
  }
  if (["processing", "pending", "parsing", "uploading"].includes(normalizedStatus)) {
    return {
      text: "处理中",
      className: "badge-warning",
    };
  }
  if (["failed", "error", "invalid"].includes(normalizedStatus)) {
    return {
      text: "异常",
      className: "badge-error",
    };
  }
  return {
    text: status || "未知",
    className: "badge-neutral",
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

      setFiles((prev) => [result.dataset, ...prev]);
      setMessage({ type: "success", text: `文件 "${file.name}" 上传成功！` });

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
    <div className="mx-auto max-w-5xl animate-fade-in">
      {/* 统计概览 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-indigo-400 tracking-tight">{files.length}</div>
          <div className="text-xs text-zinc-500 mt-1">文件总数</div>
          <div className="text-xs text-zinc-600 mt-1">筛选结果 {filteredFiles.length} 个</div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className="text-3xl font-bold text-emerald-400 tracking-tight">{formatFileSize(totalFileSize)}</div>
          <div className="text-xs text-zinc-500 mt-1">总存储体积</div>
          <div className="text-xs text-zinc-600 mt-1">单文件上限 100 MB</div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className={`text-3xl font-bold tracking-tight ${averageQuality ? getQualityColor(averageQuality) : "text-zinc-500"}`}>
            {averageQuality ? `${Math.round(averageQuality)}%` : "-"}
          </div>
          <div className="text-xs text-zinc-500 mt-1">平均质量评分</div>
          <div className="text-xs text-zinc-600 mt-1">已分析文件 {qualityKnownCount} 个</div>
        </div>
        <div className="glass-card rounded-xl p-5 text-center">
          <div className={`text-3xl font-bold tracking-tight ${processingCount > 0 ? "text-amber-400" : "text-zinc-500"}`}>{processingCount}</div>
          <div className="text-xs text-zinc-500 mt-1">处理中任务</div>
          <div className="text-xs text-zinc-600 mt-1">等待解析或入库</div>
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
        className={`w-full mb-6 rounded-xl border border-dashed p-8 text-center transition-all ${
          dragActive
            ? "scale-[1.01] border-indigo-500/50 bg-indigo-500/5"
            : "border-zinc-700/50 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-900/50"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {uploading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="font-medium text-sm text-zinc-300">正在上传并校验文件...</span>
            </div>
            <div className="mx-auto h-1.5 w-full max-w-md rounded-full bg-zinc-800">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-zinc-500">{uploadProgress}%</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10">
                <svg className="h-7 w-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
            <p className="mb-2 text-sm font-medium text-zinc-300">
              拖拽文件到此处，或 <span className="text-indigo-400">点击上传</span>
            </p>
            <p className="mb-4 text-xs text-zinc-500">
              支持 xlsx、xls、csv、json、xml 格式，文件大小不超过 100MB
            </p>
            <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-600">
              <span className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-3 py-1">自动识别列类型</span>
              <span className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-3 py-1">质量评分</span>
              <span className="rounded-full bg-zinc-800/80 border border-zinc-700/50 px-3 py-1">结构化入库</span>
            </div>
            <input
              id="upload-file-input"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json,.xml"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <span className="btn-primary inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
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
          <span className="text-sm">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto text-zinc-500 hover:text-zinc-300 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 筛选和搜索 */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">文件列表</p>
            <p className="text-xs text-zinc-500">支持按名称检索与格式筛选</p>
          </div>
          <button
            type="button"
            onClick={fetchFiles}
            className="btn-ghost inline-flex items-center gap-1 text-xs"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新列表
          </button>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  selectedFormat === format
                    ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent"
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
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-zinc-700 border-t-indigo-500"></div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-5 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800/60">
            <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-2">暂无文件</h3>
          <p className="text-zinc-500 text-sm">
            {searchQuery ? "没有找到匹配的文件" : "上传您的第一个数据文件开始使用"}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-800/60">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">文件信息</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">格式</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">大小</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">数据量</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">质量</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">状态</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">上传时间</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d={getFileIcon(file.fileFormat)} />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-zinc-200 truncate max-w-[200px]">{file.name}</p>
                          <p className="text-xs text-zinc-500 truncate max-w-[200px]">{file.fileName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getFormatTagClass(file.fileFormat)}`}>
                        {file.fileFormat.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400 whitespace-nowrap">
                      {formatFileSize(file.fileSize)}
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400 whitespace-nowrap">
                      {file.rowCount > 0 ? (
                        <span>{file.rowCount.toLocaleString()} 行 x {file.columnCount} 列</span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {file.qualityScore > 0 ? (
                        <div className="min-w-[100px]">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className={`font-medium ${getQualityColor(file.qualityScore)}`}>{file.qualityScore}%</span>
                          </div>
                          <div className="h-1 rounded-full bg-zinc-800">
                            <div
                              className={`h-1 rounded-full ${getQualityBarColor(file.qualityScore)}`}
                              style={{ width: `${file.qualityScore}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={getStatusTag(file.status).className}>
                        {getStatusTag(file.status).text}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(file.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setDeleteConfirm(file.id)}
                        className="rounded-lg p-2 text-zinc-600 transition-all hover:bg-red-500/10 hover:text-red-400"
                        title="删除文件"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md glass-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-zinc-200">确认删除</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              确定要删除文件 &quot;{files.find((f) => f.id === deleteConfirm)?.name}&quot; 吗？此操作无法撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-all shadow-lg shadow-red-500/20"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
