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