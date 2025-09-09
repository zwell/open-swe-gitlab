"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitLabSVG } from "@/components/icons/gitlab";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input"; // 2. 导入 Input 组件
import { Label } from "@/components/ui/label";

export default function GitlabAuth() {
  const router = useRouter();

  // --- 状态管理 (GitLab 版本) ---
  const [isAuth, setIsAuth] = useState<boolean | null>(null); // null 表示正在检查
  const [isLoading, setIsLoading] = useState(false); // 用于按钮的加载状态
  const [error, setError] = useState<string | null>(null); // 用于显示错误信息

  // --- 表单输入状态 ---
  const [gitlabHost, setGitlabHost] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");

  // --- 效果钩子 ---
  // 1. 组件加载时，检查后端 session 中是否已有认证信息
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // ✨ 4. 我们需要创建一个新的 API 路由来检查 GitLab 认证状态
        const response = await fetch("/api/auth/gitlab/status");
        if (response.ok) {
          const data = await response.json();
          setIsAuth(data.authenticated);
        } else {
          setIsAuth(false);
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        setIsAuth(false);
      }
    };
    checkAuthStatus();
  }, []);

  // 2. 如果认证状态变为 true，则跳转到主应用
  useEffect(() => {
    if (isAuth === true) {
      router.push("/chat");
    }
  }, [isAuth, router]);

  // --- 事件处理 ---
  const handleSaveAndConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // ✨ 5. 我们需要创建一个新的 API 路由来验证和保存凭证
      const response = await fetch("/api/auth/gitlab/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: gitlabHost || "https://gitlab.com", // 如果为空，则默认为官方 gitlab
          token: gitlabToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify credentials.");
      }

      // 验证成功，更新状态以触发跳转
      setIsAuth(true);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 渲染逻辑 ---
  // 初始加载状态，等待 checkAuthStatus 完成
  if (isAuth === null) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center p-4">
          {/* 重用原始的 Loading UI */}
          <div className="animate-in fade-in-0 zoom-in-95 flex w-full max-w-3xl flex-col rounded-lg border shadow-lg">
            <div className="flex flex-col gap-4 border-b p-6">
              <LangGraphLogoSVG className="h-7" />
              <h1 className="text-xl font-semibold tracking-tight">
                Loading...
              </h1>
              <p className="text-muted-foreground">
                Checking authentication status...
              </p>
            </div>
          </div>
        </div>
    );
  }

  // 如果 isAuth 为 false, 显示我们的 GitLab 配置表单
  if (!isAuth) {
    return (
        <div className="flex min-h-screen w-full items-center justify-center p-4">
          {/* 重用原始的 "Get Started" UI 框架 */}
          <div className="animate-in fade-in-0 zoom-in-95 flex w-full max-w-3xl flex-col rounded-lg border shadow-lg">
            <div className="flex flex-col gap-4 border-b p-6">
              <div className="flex flex-col items-start gap-2">
                <LangGraphLogoSVG className="h-7" />
                <h1 className="text-xl font-semibold tracking-tight">
                  Get started with GitLab
                </h1>
              </div>
              <p className="text-muted-foreground">
                Provide your GitLab instance URL and a Personal Access Token to
                begin.
              </p>

              {/* ✨ 6. 新的配置表单 */}
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="gitlab-host">GitLab Host (optional)</Label>
                  <Input
                      id="gitlab-host"
                      placeholder="https://gitlab.yourcompany.com"
                      value={gitlabHost}
                      onChange={(e) => setGitlabHost(e.target.value)}
                      disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave blank to use gitlab.com.
                  </p>
                </div>
                <div>
                  <Label htmlFor="gitlab-token">Personal Access Token</Label>
                  <Input
                      id="gitlab-token"
                      type="password"
                      placeholder="glpat-..."
                      value={gitlabToken}
                      onChange={(e) => setGitlabToken(e.target.value)}
                      disabled={isLoading}
                  />
                  <a href="https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block">
                    How to create a token (requires 'api' scope).
                  </a>
                </div>
              </div>

              {error && (
                  <p className="text-sm text-red-500">{error}</p>
              )}

              <Button onClick={handleSaveAndConnect} disabled={isLoading || !gitlabToken}>
                <GitLabSVG width="16" height="16" /> {/* 使用 GitLab 图标 */}
                {isLoading ? "Connecting..." : "Connect & Save"}
              </Button>
            </div>
          </div>
        </div>
    );
  }

  // 如果 isAuth 为 true, useEffect 会处理跳转，这里可以返回 null 或一个加载指示器
  return null;
}