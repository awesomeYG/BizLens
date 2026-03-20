"use client";

import { useState } from "react";

interface QueryResult {
  data: any[];
  count: number;
  sql: string;
}

interface SQLQueryEditorProps {
  dataSourceId: string;
  tenantId: string;
  onQueryExecuted?: (result: QueryResult) => void;
}

export default function SQLQueryEditor({
  dataSourceId,
  tenantId,
  onQueryExecuted,
}: SQLQueryEditorProps) {
  const [sql, setSql] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);

  const handleExecute = async () => {
    if (!sql.trim()) {
      setError("请输入 SQL 查询");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `/api/tenants/${tenantId}/data-sources/${dataSourceId}/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setResult({
          data: data.data,
          count: data.count,
          sql: data.sql,
        });
        setShowResult(true);
        onQueryExecuted?.({
          data: data.data,
          count: data.count,
          sql: data.sql,
        });
      } else {
        setError(data.error || "查询执行失败");
      }
    } catch (err: any) {
      setError("请求失败：" + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sql);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">SQL 查询</h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopySQL}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            复制 SQL
          </button>
          <button
            onClick={handleExecute}
            disabled={loading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "执行中..." : "▶ 执行查询"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="输入 SQL 查询，例如：SELECT * FROM orders LIMIT 100"
          className="w-full h-40 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">
          ❌ {error}
        </div>
      )}

      {showResult && result && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              查询结果 ({result.count} 行)
            </h4>
            <button
              onClick={() => setShowResult(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              收起
            </button>
          </div>

          <div className="overflow-auto max-h-96 border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {result.data.length > 0 &&
                    Object.keys(result.data[0]).map((key) => (
                      <th
                        key={key}
                        className="text-left px-4 py-2 font-medium text-gray-700 border-b border-gray-200"
                      >
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {result.data.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((val: any, j) => (
                      <td
                        key={j}
                        className="px-4 py-2 text-gray-900 border-b border-gray-100 font-mono text-xs"
                      >
                        {val === null ? (
                          <span className="text-gray-400">NULL</span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.count > 100 && (
              <div className="p-3 bg-gray-50 text-sm text-gray-600 text-center">
                显示前 100 行，共 {result.count} 行
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
