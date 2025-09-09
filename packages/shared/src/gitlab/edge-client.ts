import {GitLabUser} from "./verify-user.js";
import {GitLabBranch, GitLabProject, GitLabIssue, GitLabMergeRequest, GitLabNote} from "./types.js";

interface GitLabResponse<T> {
    data: T;
    headers: Headers;
}

/**
 * 一个兼容 Edge Runtime 的轻量级 GitLab API 客户端。
 */
export class GitLabEdgeClient {
    private host: string;
    private token: string;
    private baseUrl: string;

    constructor(options: { token: string; host?: string }) {
        if (!options.token) {
            throw new Error("GitLab client requires a token.");
        }
        this.token = options.token;
        this.host = options.host || "https://gitlab.com";
        this.baseUrl = `${this.host}/api/v4`;
    }

    /**
     * 封装了底层的 fetch 请求
     */
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<GitLabResponse<T>> {
        const url = `${this.baseUrl}${endpoint}`;

        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${this.token}`);

        // 只有在有 body 的情况下才设置 Content-Type
        if (options.body) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitLab API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // ✨ 2. 在解析 body 之前，先获取 headers，因为 body 流只能被读取一次
        const responseHeaders = response.headers;

        // ✨ 3. 解析 body
        const data = response.status === 204 ? null : await response.json();

        // ✨ 4. 将 data 和 headers 一起返回
        return {
            data: data as T,
            headers: responseHeaders,
        };
    }

    /**
     * 获取当前认证用户的信息。
     */
    public async getCurrentUser(): Promise<GitLabUser> {
        const { data } =  await this.request<GitLabUser>("/user");
        return data
    }

    /**
     * 获取用户有权访问的项目列表，并返回分页信息。
     */
    public async getProjects(options: {
        page?: number;
        perPage?: number;
        minAccessLevel?: number;
    } = {}): Promise<{
        projects: GitLabProject[];
        pagination: {
            page: number;
            perPage: number;
            totalPages: number;
            totalCount: number;
            hasMore: boolean;
        };
    }> {
        const { page = 1, perPage = 20, minAccessLevel = 30 } = options;
        const endpoint = `/projects?membership=true&min_access_level=${minAccessLevel}&page=${page}&per_page=${perPage}&order_by=last_activity_at&sort=desc`;

        const { data: projects, headers } = await this.request<GitLabProject[]>(endpoint);

        // 从响应头中解析分页信息
        const totalPages = parseInt(headers.get("x-total-pages") || "0", 10);
        const totalCount = parseInt(headers.get("x-total") || "0", 10);
        const currentPage = parseInt(headers.get("x-page") || "1", 10);
        const hasMore = currentPage < totalPages;

        return {
            projects,
            pagination: {
                page: currentPage,
                perPage: parseInt(headers.get("x-per-page") || perPage.toString(), 10),
                totalPages,
                totalCount,
                hasMore,
            },
        };
    }

    /**
     * 获取指定项目的所有分支。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param page 要获取的页码。
     * @param perPage 每页的项目数。
     * @returns 分支对象数组。
     */
    public async getProjectBranches(
        projectIdOrPath: number | string,
        page = 1,
        perPage = 20
    ): Promise<GitLabBranch[]> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/repository/branches?page=${page}&per_page=${perPage}`;
        const {data} = await this.request<GitLabBranch[]>(endpoint);
        return data
    }

    // --- ✨ 新增方法：获取单个特定分支 ✨ ---
    /**
     * 获取指定项目的单个分支。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param branchName 要获取的分支名称。
     * @returns 单个分支对象。如果找不到，GitLab API 会返回 404，方法会抛出错误。
     */
    public async getProjectBranch(
        projectIdOrPath: number | string,
        branchName: string
    ): Promise<GitLabBranch> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/repository/branches/${encodeURIComponent(branchName)}`;
        const {data} = await this.request<GitLabBranch>(endpoint);
        return data
    }

    // --- ✨ 新增方法：获取单个 Issue ✨ ---
    /**
     * 获取指定项目的单个 Issue。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param issueIid Issue 在项目内部的唯一 ID (IID)。
     * @returns 单个 Issue 对象。如果找不到，GitLab API 会返回 404，方法会抛出错误。
     */
    public async getIssue(
        projectIdOrPath: number | string,
        issueIid: number
    ): Promise<GitLabIssue> {
        // GitLab API 端点: GET /projects/:id/issues/:issue_iid
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/issues/${issueIid}`;

        // 调用我们底层的 request 方法
        const { data } = await this.request<GitLabIssue>(endpoint);

        return data;
    }

    // --- (可选，但强烈推荐) 添加获取 Issue 评论的方法 ---
    /**
     * 获取指定 Issue 的所有评论（备注）。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param issueIid Issue 的 IID。
     * @returns 评论对象数组。
     */
    public async getIssueComments(
        projectIdOrPath: number | string,
        issueIid: number
    ): Promise<any[]> { // 您可以为此创建一个更具体的类型
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/issues/${issueIid}/notes?sort=asc&order_by=created_at`;
        const { data } = await this.request<any[]>(endpoint);
        return data;
    }

    /**
     * 更新一个已存在的 Issue。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param issueIid 要更新的 Issue 的 IID。
     * @param options 包含要更新的字段的对象，例如 { description: "new body" }。
     * @returns 更新后的 Issue 对象。
     */
    public async updateIssue(
        projectIdOrPath: number | string,
        issueIid: number,
        options: { title?: string; description?: string; state_event?: 'close' | 'reopen'; [key: string]: any }
    ): Promise<GitLabIssue> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/issues/${issueIid}`;

        const { data } = await this.request<GitLabIssue>(endpoint, {
            method: 'PUT', // GitLab 使用 PUT 方法更新资源
            body: JSON.stringify(options),
        });

        return data;
    }

    public async createIssue(
        projectIdOrPath: number | string,
        options: { title: string; description?: string; labels?: string[] }
    ): Promise<GitLabIssue> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/issues`;
        const { data } = await this.request<GitLabIssue>(endpoint, {
            method: 'POST',
            body: JSON.stringify(options),
        });
        return data;
    }

    public async createIssueNote(
        projectIdOrPath: number | string,
        issueIid: number,
        body: string,
    ): Promise<GitLabNote> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/issues/${issueIid}/notes`;
        const { data } = await this.request<GitLabNote>(endpoint, {
            method: 'POST',
            body: JSON.stringify({ body }),
        });
        return data;
    }

    /**
     * 获取指定项目的详细信息。
     * 这对于获取项目的默认分支等元数据非常有用。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @returns 单个项目对象。
     */
    public async getProject(projectIdOrPath: number | string): Promise<GitLabProject> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}`;
        const { data } = await this.request<GitLabProject>(endpoint);
        return data;
    }

    /**
     * 在指定项目中创建一个新的 Merge Request。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param options 创建 MR 所需的参数。
     * @returns 创建成功后的 Merge Request 对象。
     */
    public async createMergeRequest(
        projectIdOrPath: number | string,
        options: {
            source_branch: string;
            target_branch: string;
            title: string;
            description?: string;
            labels?: string[];
            remove_source_branch?: boolean; // 一个有用的 GitLab 特定选项
            squash?: boolean; // 合并时是否 Squash
        }
    ): Promise<GitLabMergeRequest> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests`;
        const { data } = await this.request<GitLabMergeRequest>(endpoint, {
            method: 'POST',
            body: JSON.stringify(options),
        });
        return data;
    }

    public async getMergeRequest(projectIdOrPath: number | string, mergeRequestIid: number): Promise<GitLabMergeRequest> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests/${mergeRequestIid}`;
        const { data } = await this.request<GitLabMergeRequest>(endpoint);
        return data;
    }

    public async updateMergeRequest(
        projectIdOrPath: number | string,
        mergeRequestIid: number,
        options: { title?: string; description?: string; /* ... other options ... */ }
    ): Promise<GitLabMergeRequest> {
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/merge_requests/${mergeRequestIid}`;
        const { data } = await this.request<GitLabMergeRequest>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(options),
        });
        return data;
    }

    /**
     * 更新一个已存在的 Issue 评论 (Note)。
     * @param projectIdOrPath 项目的 ID 或 URL-encoded 路径。
     * @param issueIid 评论所在的 Issue 的 IID。
     * @param noteId 要更新的评论的 ID。
     * @param body 新的评论内容。
     * @returns 更新后的 Note 对象。
     */
    public async updateIssueNote(
        projectIdOrPath: number | string,
        issueIid: number,
        noteId: number,
        body: string
    ): Promise<GitLabNote> {
        // GitLab API 端点: PUT /projects/:id/issues/:issue_iid/notes/:note_id
        const endpoint = `/projects/${encodeURIComponent(projectIdOrPath)}/issues/${issueIid}/notes/${noteId}`;

        const { data } = await this.request<GitLabNote>(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ body }),
        });

        return data;
    }
}