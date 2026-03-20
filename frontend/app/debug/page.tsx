"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentUser,
  quickLoginWithMockData,
  logoutUser,
  setMockMode,
  isMockMode,
  MOCK_DATA,
} from "@/lib/user-store";

export default function DebugPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [mockMode, setMockModeState] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    setMockModeState(isMockMode());
  }, []);

  const handleQuickLogin = () => {
    quickLoginWithMockData();
    setUser(getCurrentUser());
    alert("✓ 已使用 Mock 数据快速登录\n\n点击确定跳转到首页");
    router.push("/");
  };

  const handleClearData = () => {
    if (confirm("确定要清除所有本地数据吗？")) {
      logoutUser();
      setUser(null);
      localStorage.removeItem("bizlens-config");
      localStorage.removeItem("ai-bi-user-session");
      alert("✓ 已清除所有本地数据");
    }
  };

  const handleToggleMockMode = () => {
    setMockMode(!mockMode);
    setMockModeState(!mockMode);
    alert(`Mock 模式已${!mockMode ? "启用" : "禁用"}`);
  };

  const handleResetOnboarding = () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      currentUser.isOnboarded = false;
      localStorage.setItem("ai-bi-user-session", JSON.stringify(currentUser));
      setUser(currentUser);
      alert("✓ 已重置 onboarding 状态\n\n刷新页面后将重新显示初始化向导");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">🔧 调试工具</h1>
            <p className="text-gray-400 mt-1">BizLens v0.2.0 - 开发测试工具</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
          >
            ← 返回首页
          </button>
        </div>

        <div className="grid gap-6">
          {/* 当前用户状态 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📊 当前用户状态</h2>
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>已登录</span>
                </div>
                <div>
                  <div className="text-sm text-gray-400">姓名</div>
                  <div className="font-mono">{user.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">邮箱</div>
                  <div className="font-mono">{user.email}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Onboarding</div>
                  <div className={`font-mono ${user.isOnboarded ? "text-green-400" : "text-yellow-400"}`}>
                    {user.isOnboarded ? "已完成" : "未完成"}
                  </div>
                </div>
                {user.companyInfo && (
                  <div>
                    <div className="text-sm text-gray-400">公司</div>
                    <div className="font-mono text-sm">{user.companyInfo.companyName}</div>
                  </div>
                )}
                {user.dataSources && (
                  <div>
                    <div className="text-sm text-gray-400">数据源数量</div>
                    <div className="font-mono">{user.dataSources.length} 个</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400">未登录</div>
            )}
          </div>

          {/* 快速操作 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">⚡ 快速操作</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={handleQuickLogin}
                className="px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 text-left"
              >
                🚀 快速登录（Mock 数据）
                <div className="text-sm text-green-200 mt-1">
                  使用电商公司数据，跳过初始化
                </div>
              </button>

              <button
                onClick={handleClearData}
                className="px-4 py-3 bg-red-600 rounded-lg hover:bg-red-700 text-left"
              >
                🗑️ 清除所有数据
                <div className="text-sm text-red-200 mt-1">
                  删除 localStorage 中的所有数据
                </div>
              </button>

              <button
                onClick={handleResetOnboarding}
                disabled={!user}
                className="px-4 py-3 bg-yellow-600 rounded-lg hover:bg-yellow-700 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 重置 Onboarding
                <div className="text-sm text-yellow-200 mt-1">
                  重新显示初始化向导
                </div>
              </button>

              <button
                onClick={handleToggleMockMode}
                className={`px-4 py-3 rounded-lg text-left ${
                  mockMode
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                🎭 Mock 模式：{mockMode ? "已启用" : "已禁用"}
                <div className="text-sm text-gray-300 mt-1">
                  {mockMode ? "点击禁用" : "点击启用"}
                </div>
              </button>
            </div>
          </div>

          {/* Mock 数据预览 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📦 Mock 数据预览</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">企业信息</h3>
                <pre className="bg-gray-900 rounded p-4 text-xs overflow-auto">
                  {JSON.stringify(MOCK_DATA.companyInfo, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">企业画像</h3>
                <pre className="bg-gray-900 rounded p-4 text-xs overflow-auto">
                  {JSON.stringify(MOCK_DATA.companyProfile, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">数据源</h3>
                <pre className="bg-gray-900 rounded p-4 text-xs overflow-auto">
                  {JSON.stringify(MOCK_DATA.dataSources, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* 使用说明 */}
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">💡 使用说明</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• <strong>快速登录</strong>: 一键使用 Mock 数据登录，跳过初始化流程</li>
              <li>• <strong>清除数据</strong>: 删除所有本地存储，恢复到初始状态</li>
              <li>• <strong>重置 Onboarding</strong>: 重新显示企业信息和数据源配置向导</li>
              <li>• <strong>Mock 模式</strong>: 启用后会自动使用 Mock 数据（开发中）</li>
            </ul>
            <div className="mt-4 p-3 bg-blue-900/50 rounded text-sm">
              <strong>提示：</strong>在首页点击 "🚀 快速测试" 按钮也可以快速登录
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
