import type {
    IssueSchema,
    NoteSchema,
    MergeRequestSchema,
    BranchSchema,
    ProjectSchema,
} from "@gitbeaker/core/dist/types/types.js";

/**
 * GitLab Issue (议题) 的数据结构。
 * 对应于 GitHubIssue。
 * @see https://docs.gitlab.com/ee/api/issues.html
 */
export type GitLabIssue = IssueSchema;

/**
 * GitLab Note (备注/评论) 的数据结构。
 * 对应于 GitHubIssueComment。
 * @see https://docs.gitlab.com/ee/api/notes.html
 */
export type GitLabNote = NoteSchema;

/**
 * GitLab Merge Request (合并请求) 的数据结构。
 * 对应于 GitHubPullRequest。
 * @see https://docs.gitlab.com/ee/api/merge_requests.html
 */
export type GitLabMergeRequest = MergeRequestSchema;

/**
 * GitLab Branch (分支) 的数据结构。
 * 对应于 GitHubBranch。
 * @see https://docs.gitlab.com/ee/api/branches.html
 */
export type GitLabBranch = BranchSchema;

/**
 * GitLab Project (项目) 的数据结构。
 * 这是 GitLab 的核心实体，大致对应于 GitHub Repository。
 * @see https://docs.gitlab.com/ee/api/projects.html
 */
export type GitLabProject = ProjectSchema;

// // ✨ 新增：定义 Branch 类型，与 GitLab API 响应对齐
// export interface GitLabBranch {
//     name: string;
//     commit: {
//         id: string; // GitLab 返回 commit.id, 我们可以映射到 sha
//         [key: string]: any;
//     };
//     protected: boolean;
//     [key: string]: any;
// }
//
// export interface GitLabProject {
//     id: number;
//     name: string;
//     full_name: string; // 注意：我们之前映射成了 full_name
//     description: string | null;
//     private: boolean;
//     html_url: string;
//     default_branch: string | null;
//     issues_enabled: boolean;
// }

/**
 * 定义了 /api/gitlab/projects 端点返回的完整响应的数据结构。
 */
export interface GitLabProjectsResponse {
    repositories: GitLabProject[]; // 保持字段名为 repositories 以便前端复用
    pagination: {
        page: number;
        perPage: number;
        hasMore: boolean;
        totalCount: number;
    };
}

// export interface GitLabIssue {
//     iid: number;
//     project_id: number;
//     title: string;
//     description: string | null;
//     [key: string]: any; // 其他属性
// }
//
// export interface GitLabUser  {
//     id: number;
//     name: string;
//     username: string;
//     state: string;
//     avatar_url: string;
//     web_url: string;
//     created_at?: string;
// }
//
// export interface GitLabNote {
//     id: number;
//     body: string;
//     author: GitLabUser;
//     created_at: string;
//     updated_at: string;
//     confidential: boolean;
// }

