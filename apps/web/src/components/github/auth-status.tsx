// src/components/gitlab/AuthStatus.tsx (最终版本)

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitLabSVG } from "@/components/icons/gitlab";
import { LangGraphLogoSVG } from "@/components/icons/langgraph"; // 确保路径正确
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "next/navigation";
import { GitLabAppProvider, useGitLabAppProvider } from "@/providers/GitLabApp"; // 确保路径正确

/**
 * 这个内部组件现在从 GitLab Context 中获取状态
 */
function AuthStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✨ 1. 从我们的 GitLab Provider 获取状态 ✨
  // isAuthenticated 状态现在由 useGitLabAppProvider 管理
  const { isAuthenticated, isLoading: isProviderLoading, error: providerError } = useGitLabAppProvider();

  // 本地状态只用于表单交互
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 从 URL query 中读取登录失败的错误信息
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'invalid_credentials') {
      setError('Invalid host or token. Please try again.');
    } else if (errorParam === 'token_required') {
      setError('Access Token is a required field.');
    } else if (errorParam) {
      setError('An unexpected error occurred during login.');
    }
  }, [searchParams]);

  // ✨ 2. 核心跳转逻辑大大简化 ✨
  // 当 Provider 确认用户已认证时，直接跳转
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = () => {
    setIsConnecting(true);
    // 表单的 action 会处理提交，这里只负责显示加载状态
  };

  // --- 渲染逻辑 ---

  // 状态1: Provider 正在从后端检查认证状态
  if (isProviderLoading) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center p-4">
          {/* 复用 Loading UI */}
          <div className="animate-in fade-in-0 zoom-in-95 flex w-full max-w-3xl flex-col rounded-lg border shadow-lg">
            <div className="flex flex-col gap-4 border-b p-6">
              <LangGraphLogoSVG className="h-7" />
              <h1 className="text-xl font-semibold tracking-tight">Loading...</h1>
              <p className="text-muted-foreground">Checking authentication status...</p>
            </div>
          </div>
        </div>
    );
  }

  // 状态2: 未认证，显示 GitLab 配置表单
  // isAuthenticated 为 false 时会显示这个
  if (!isAuthenticated) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center p-4">
          <div className="animate-in fade-in-0 zoom-in-95 flex w-full max-w-3xl flex-col rounded-lg border shadow-lg">
            <form
                action="/api/auth/gitlab/login" // 指向我们的 GitLab 登录 API
                method="POST"
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 border-b p-6"
            >
              <div className="flex flex-col items-start gap-2">
                <LangGraphLogoSVG className="h-7" />
                <h1 className="text-xl font-semibold tracking-tight">Get started with GitLab</h1>
              </div>
              <p className="text-muted-foreground">
                Provide your GitLab instance URL and a Personal Access Token to begin.
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="host">GitLab Host (optional)</Label>
                  <Input
                      id="host"
                      name="host"
                      placeholder="https://gitlab.yourcompany.com"
                      disabled={isConnecting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to use gitlab.com.</p>
                </div>
                <div>
                  <Label htmlFor="token">Personal Access Token</Label>
                  <Input
                      id="token"
                      name="token"
                      type="password"
                      required
                      disabled={isConnecting}
                  />
                  <a href="https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">
                    How to create a token (requires 'api' scope).
                  </a>
                </div>
              </div>

              {(error || providerError) && <p className="text-sm text-red-500">{error || providerError}</p>}

              <Button type="submit" disabled={isConnecting}>
                <GitLabSVG width="16" height="16" className="mr-2" />
                {isConnecting ? "Connecting..." : "Connect & Login"}
              </Button>
            </form>
          </div>
        </div>
    );
  }

  // 状态3: 已认证 (isAuthenticated is true)
  // useEffect 正在处理跳转，这里可以返回一个加载指示器或 null
  return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="animate-in fade-in-0 zoom-in-95 flex w-full max-w-3xl flex-col rounded-lg border shadow-lg">
          <div className="flex flex-col gap-4 border-b p-6">
            <LangGraphLogoSVG className="h-7" />
            <h1 className="text-xl font-semibold tracking-tight">Authenticated!</h1>
            <p className="text-muted-foreground">Redirecting to your workspace...</p>
          </div>
        </div>
      </div>
  );
}

/**
 * 这是导出给 page.tsx 使用的主组件
 * 它负责提供 GitLab Context
 */
export default function AuthStatus() {
  return (
      <GitLabAppProvider>
        <AuthStatusContent />
      </GitLabAppProvider>
  );
}