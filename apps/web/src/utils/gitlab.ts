// src/utils/gitlab.ts (新文件)

import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { GitLabProject } from "@open-swe/shared/gitlab/types"; // 从共享类型导入


export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}


// 注意：这些函数应该在后端 API 路由中被调用，前端只调用 API 路由

// 获取项目分支 (这个逻辑应该在后端 API 路由中)
export async function getProjectBranches(client: GitLabEdgeClient, projectId: number, page: number) {
  const branches = await client.getProjectBranches(projectId, page); // 假设你在 client 中实现了这个方法
  return { branches, hasMore: branches.length > 0 };
}

// 搜索分支 (这个逻辑也应该在后端)
export async function searchBranch(client: GitLabEdgeClient, projectId: number, branchName: string) {
  const branch = await client.getProjectBranch(projectId, branchName); // 假设 client 中有此方法
  return branch;
}