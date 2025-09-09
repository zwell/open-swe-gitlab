import { NextRequest, NextResponse } from "next/server";
import { GITLAB_TOKEN_COOKIE, GITLAB_HOST_COOKIE } from "@open-swe/shared/constants";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";

// params 会包含动态路由段的值, e.g., { projectId: '123' }
export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const token = request.cookies.get(GITLAB_TOKEN_COOKIE)?.value;
    const host = request.cookies.get(GITLAB_HOST_COOKIE)?.value;
    if (!token || !host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "20", 10);

    const client = new GitLabEdgeClient({
      token,
      host,
    });

    // ✨ 在这里，我们调用了您指出的那个正确的方法 ✨
    const branches = await client.getProjectBranches(projectId, page, perPage);

    // 我们可以简单地判断是否还有更多页
    const hasMore = branches.length === perPage;

    // 转换数据结构，只返回前端需要的信息
    const transformedBranches = branches.map(b => ({
      name: b.name,
      commit: { sha: b.commit.id },
      protected: b.protected
    }));

    return NextResponse.json({
      branches: transformedBranches,
      pagination: {
        page: page,
        hasMore: hasMore,
      }
    });

  } catch (error: any) {
    console.error(`Error fetching branches for project ${params.projectId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}