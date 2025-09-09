// app/api/gitlab/projects/route.ts (重构后)

import { NextRequest, NextResponse } from "next/server";
import { GITLAB_TOKEN_COOKIE, GITLAB_HOST_COOKIE } from "@open-swe/shared/constants";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { GitLabProject } from "@open-swe/shared/gitlab/types"; // 导入共享类型

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(GITLAB_TOKEN_COOKIE)?.value;
    const host = request.cookies.get(GITLAB_HOST_COOKIE)?.value;
    if (!token || !host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "20", 10);
    const minAccessLevel = parseInt(searchParams.get("min_access_level") || "30", 10);

    const client = new GitLabEdgeClient({
      token,
      host,
    });

    // ✨ 一行代码完成所有数据获取和分页处理 ✨
    const { projects, pagination } = await client.getProjects({
      page,
      perPage,
      minAccessLevel,
    });

    // 转换数据结构以匹配前端期望
    const transformedProjects: GitLabProject[] = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      full_name: p.path_with_namespace,
      description: p.description,
      private: p.visibility === 'private',
      html_url: p.web_url,
      default_branch: p.default_branch,
      issues_enabled: p.issues_enabled,
    }));

    // 返回最终响应
    return NextResponse.json({
      repositories: transformedProjects, // 保持字段名一致
      pagination: { // 保持分页结构一致
        page: pagination.page,
        perPage: pagination.perPage,
        hasMore: pagination.hasMore,
        totalCount: pagination.totalCount,
      },
    });

  } catch (error: any) {
    console.error("Error in /api/gitlab/projects:", error);
    return NextResponse.json({ error: "Failed to fetch GitLab projects." }, { status: 500 });
  }
}