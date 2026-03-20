"use client";

import { useState } from "react";

interface Column {
  field: string;
  type: string;
  nullable: boolean;
  default?: string;
}

interface TableSchema {
  name: string;
  columns: Column[];
  rowCount?: number;
}

interface SchemaExplorerProps {
  schemaContext: string;
  tables: TableSchema[];
  onTableClick?: (tableName: string) => void;
  onPreviewSample?: (tableName: string) => void;
}

export default function SchemaExplorer({
  schemaContext,
  tables,
  onTableClick,
  onPreviewSample,
}: SchemaExplorerProps) {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    setExpandedTable(expandedTable === tableName ? null : tableName);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">数据库 Schema</h3>
        <span className="text-sm text-gray-500">{tables.length} 张表</span>
      </div>

      <div className="space-y-2">
        {tables.map((table) => (
          <div
            key={table.name}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <div
              className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 flex items-center justify-between"
              onClick={() => toggleTable(table.name)}
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expandedTable === table.name ? "transform rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium text-gray-900">{table.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {table.rowCount !== undefined && (
                  <span className="text-xs text-gray-500">
                    {table.rowCount.toLocaleString()} 行
                  </span>
                )}
                {onPreviewSample && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewSample(table.name);
                    }}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    预览数据
                  </button>
                )}
              </div>
            </div>

            {expandedTable === table.name && (
              <div className="p-4 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-600 font-medium">字段</th>
                      <th className="text-left py-2 text-gray-600 font-medium">类型</th>
                      <th className="text-left py-2 text-gray-600 font-medium">可空</th>
                      <th className="text-left py-2 text-gray-600 font-medium">默认值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((col) => (
                      <tr key={col.field} className="border-b border-gray-100">
                        <td className="py-2 text-gray-900 font-mono">{col.field}</td>
                        <td className="py-2 text-gray-600 font-mono text-xs">{col.type}</td>
                        <td className="py-2 text-gray-600">
                          {col.nullable ? (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded">是</span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">否</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-500 font-mono text-xs">
                          {col.default || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {onTableClick && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => onTableClick(table.name)}
                      className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                    >
                      复制表名到对话
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {schemaContext && (
        <details className="mt-4">
          <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
            📋 查看完整 Schema 上下文（AI 可读）
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-96">
            {schemaContext}
          </pre>
        </details>
      )}
    </div>
  );
}
