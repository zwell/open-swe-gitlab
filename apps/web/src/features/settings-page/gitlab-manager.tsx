"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, GitBranch, Lock, Globe, ExternalLink, LogIn } from "lucide-react";
import { GitLabSVG } from "@/components/icons/gitlab"; // 使用我们的 GitLab 图标
import { useGitLabAppProvider } from "@/providers/GitLabApp"; // ✨ 使用新的 Hook
import { cn } from "@/lib/utils";
import {pages} from "next/dist/build/templates/app-page";

// 这个组件现在是配置页面的核心
export function GitLabManager() {
  // ✨ 从新的 Hook 中获取 GitLab 状态
  const {
    projects,
    isLoading,
    error,
    projectsHasMore,
    loadMoreProjects,
    refreshProjects,
  } = useGitLabAppProvider();

  const handleLogin = () => {
    // 假设未认证时会跳转回主页，由主页的 Auth 组件处理
    window.location.href = "/";
  };

  const handleManageOnGitLab = () => {
    const gitlabHost = process.env.NEXT_PUBLIC_GITLAB_HOST || "https://gitlab.com";
    // 直接引导到个人访问令牌页面
    window.open(`${gitlabHost}/-/profile/personal_access_tokens`, "_blank");
  };

  // --- 状态渲染逻辑 ---

  // 1. 认证错误状态 (由 Hook 返回的 error 判断)
  if (error && error.toLowerCase().includes("authenticate")) {
    return (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <GitLabSVG className="h-6 w-6" />
                GitLab Authentication Required
              </CardTitle>
              <CardDescription>
                Please configure your GitLab Access Token to manage your projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6">
                <h3 className="text-lg font-semibold mb-2">Connect Your GitLab Account</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This app requires a Personal Access Token with 'api' scope to access your projects.
                </p>
                <Button onClick={handleLogin} size="lg">
                  <LogIn className="mr-2 h-4 w-4" />
                  Go to Configuration Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
    );
  }

  // 2. 加载中状态
  if (isLoading && projects.length === 0) {
    return (
        <div className="space-y-8">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">GitHub Integration</CardTitle>
                  <CardDescription>Loading your GitHub setup...</CardDescription>
                </div>
                <div className="bg-muted h-10 w-24 animate-pulse rounded"></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                  <div
                      key={i}
                      className="bg-muted h-20 animate-pulse rounded"
                  ></div>
              ))}
            </CardContent>
          </Card>
        </div>
    );
  }

  // 3. 其他错误状态
  if (error) {
    return (
        <div className="space-y-8">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-destructive text-xl">
                GitHub Integration Error
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {/*<Button*/}
                {/*    onClick={handleRefresh}*/}
                {/*    variant="outline"*/}
                {/*>*/}
                {/*  <RefreshCw className="mr-2 h-4 w-4" />*/}
                {/*  Try Again*/}
                {/*</Button>*/}
                <Button
                    onClick={handleLogin}
                    variant="default"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Re-authenticate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
    );
  }

  // 4. 完全就绪状态
  return (
      <div className="space-y-8">
        {/* 移除了 GitHub App 安装和组织选择器相关的卡片 */}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Your GitLab Projects</CardTitle>
                <CardDescription>
                  Projects you have at least 'Developer' access to.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-mono">
                  {projects.length} projects
                </Badge>
                {/*<Button onClick={refreshProjects} disabled={isLoading} variant="outline" size="sm">*/}
                {/*  <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />*/}
                {/*  Refresh*/}
                {/*</Button>*/}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No projects found. Ensure your token has 'api' scope and you are a member of at least one project.
                  </p>
                </div>
            ) : (
                <>
                  {projects.map((repo, index) => (
                      <div key={repo.id}>
                        <div className="flex items-start p-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {/* full_name 是我们在 API 路由中映射好的字段 */}
                              <h3 className="font-semibold font-mono">{repo.full_name}</h3>
                              <Badge variant={repo.private ? "secondary" : "outline"}>
                                {/* ... private/public badge logic ... */}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{repo.description}</p>
                            <div className="text-sm text-muted-foreground flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <GitBranch className="h-3 w-3" />
                                <span>Default: {repo.default_branch}</span>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => window.open(repo.html_url, "_blank")}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                        {index < projects.length - 1 && <Separator />}
                      </div>
                  ))}

                  {projectsHasMore && (
                      <div className="pt-4 text-center">
                        <Button onClick={loadMoreProjects} disabled={isLoading} variant="outline">
                          {isLoading ? "Loading..." : "Load More Projects"}
                        </Button>
                      </div>
                  )}
                </>
            )}
          </CardContent>
        </Card>

        {/*<Card>*/}
        {/*  <CardHeader>*/}
        {/*    <CardTitle className="text-xl">GitLab Token Management</CardTitle>*/}
        {/*    <CardDescription>*/}
        {/*      You can manage your Personal Access Tokens directly on GitLab.*/}
        {/*    </CardDescription>*/}
        {/*  </CardHeader>*/}
        {/*  <CardContent>*/}
        {/*    <div className="flex items-center justify-between p-4">*/}
        {/*      <div>*/}
        {/*        <h3 className="font-semibold mb-1">Access Token Settings</h3>*/}
        {/*        <p className="text-sm text-muted-foreground">*/}
        {/*          Create new tokens or revoke existing ones in your GitLab profile.*/}
        {/*        </p>*/}
        {/*      </div>*/}
        {/*      <Button onClick={handleManageOnGitLab} variant="outline">*/}
        {/*        <ExternalLink className="mr-2 h-4 w-4" />*/}
        {/*        Manage on GitLab*/}
        {/*      </Button>*/}
        {/*    </div>*/}
        {/*  </CardContent>*/}
        {/*</Card>*/}
      </div>
  );
}