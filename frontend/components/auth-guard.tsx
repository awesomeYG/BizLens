"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/user-store";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 认证守卫组件
 * 
 * 用法：
 * 1. 包裹需要认证的内容
 * 2. 如果用户未认证，自动重定向到登录页
 * 3. 可选的 fallback 内容（ loading 状态）
 */
export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticatedUser, setIsAuthenticatedUser] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 检查认证状态
      const auth = isAuthenticated();
      
      if (!auth) {
        // 未认证，重定向到登录页
        router.replace("/auth/login");
        return;
      }
      
      setIsAuthenticatedUser(true);
      setIsChecking(false);
    };

    checkAuth();
  }, [router]);

  // 检查中显示 loading 或 fallback
  if (isChecking) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 未认证时不渲染内容（会重定向）
  if (!isAuthenticatedUser) {
    return null;
  }

  // 已认证，渲染子组件
  return <>{children}</>;
}

/**
 * 未认证守卫组件（用于登录/注册页）
 * 如果用户已认证，重定向到首页
 */
export function UnAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const auth = isAuthenticated();
      
      if (auth) {
        // 已认证，进入 AI 对话
        router.replace("/chat");
        return;
      }
      
      setShouldRender(true);
      setIsChecking(false);
    };

    checkAuth();
  }, [router]);

  if (isChecking) {
    return null;
  }

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}

/**
 * 角色守卫组件
 * 检查用户是否有指定角色
 */
export function RoleGuard({
  children,
  allowedRoles,
  fallback,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      // TODO: 实现用户角色检查
      // 目前简化处理，假设已认证用户都有权限
      const auth = isAuthenticated();
      
      if (!auth) {
        router.replace("/auth/login");
        return;
      }
      
      // TODO: 从用户信息中获取角色并检查
      setHasPermission(true);
      setIsChecking(false);
    };

    checkRole();
  }, [allowedRoles, router]);

  if (isChecking) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">权限不足</h1>
          <p className="mt-2 text-gray-600">您没有访问此页面的权限</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
