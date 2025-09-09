import { GitLabIssue, GitLabNote, GitLabMergeRequest, GitLabBranch } from "@open-swe/shared/gitlab/types";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { createLogger, LogLevel } from "../logger.js";

const logger = createLogger(LogLevel.INFO, "GitLab-API");

export async function getIssue(
    input: { owner: string; repo: string; issueNumber: number; token: string; host: string;   },
): Promise<GitLabIssue | null> {
  try {
    const client = new GitLabEdgeClient({ token:input.token, host:input.host });
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    return await client.getIssue(projectIdOrPath, input.issueNumber);
  } catch (error) {
    logger.error("Failed to get GitLab issue", { input, error });
    return null;
  }
}

export async function getIssueComments(
    input: { owner: string; repo: string; issueNumber: number; filterBotComments: boolean; token: string; host: string; },
): Promise<GitLabNote[] | null> {
  try {
    const client = new GitLabEdgeClient({ token:input.token, host:input.host });
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    const comments = await client.getIssueComments(projectIdOrPath, input.issueNumber);

    if (input.filterBotComments) {
      return comments.filter(comment => !comment.author.bot);
    }
    return comments;
  } catch (error) {
    logger.error("Failed to get GitLab issue comments", { input, error });
    return null;
  }
}

export async function createIssue(
    input: { owner: string; repo: string; title: string; body: string; token: string; host: string;},
): Promise<GitLabIssue | null> {
  try {
    const client = new GitLabEdgeClient({ token:input.token, host:input.host });
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    return await client.createIssue(projectIdOrPath, { title: input.title, description: input.body });
  } catch (error) {
    logger.error("Failed to create GitLab issue", { input, error });
    return null;
  }
}

export async function updateIssue(
    input: { owner: string; repo: string; issueNumber: number; body?: string; title?: string; token: string; host: string; },
): Promise<GitLabIssue | null> {
  try {
    const client = new GitLabEdgeClient({host:input.host, token:input.token});
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    const updateOptions: { description?: string; title?: string } = {};
    if (input.body) updateOptions.description = input.body;
    if (input.title) updateOptions.title = input.title;

    return await client.updateIssue(projectIdOrPath, input.issueNumber, updateOptions);
  } catch (error) {
    logger.error("Failed to update GitLab issue", { input, error });
    return null;
  }
}

export async function createIssueComment(
    input: { owner: string; repo: string; issueNumber: number; body: string; token: string; host: string; },
): Promise<GitLabNote | null> {
  try {
    const client = new GitLabEdgeClient({host:input.host, token:input.token});
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    return await client.createIssueNote(projectIdOrPath, input.issueNumber, input.body);
  } catch (error) {
    logger.error("Failed to create GitLab issue comment", { input, error });
    return null;
  }
}

export async function createPullRequest(
    input: { owner: string; repo: string; headBranch: string; title: string; body?: string; baseBranch?: string; token: string; host: string; },
): Promise<GitLabMergeRequest | null> {
  try {
    const client = new GitLabEdgeClient({host:input.host, token:input.token});
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    let targetBranch = input.baseBranch;
    if (!targetBranch) {
      const project = await client.getProject(projectIdOrPath);
      targetBranch = project.default_branch;
    }

    if (!targetBranch) {
      throw new Error("Could not determine target branch for Merge Request.");
    }

    // (需要在 GitLabEdgeClient 中添加 createMergeRequest 方法)
    return await client.createMergeRequest(projectIdOrPath, {
      source_branch: input.headBranch,
      target_branch: targetBranch,
      title: input.title,
      description: input.body,
    });
  } catch (error: any) {
    if (error.message && error.message.includes("another merge request already exists")) {
      logger.warn("Merge Request already exists. Future logic could fetch the existing one.", { input });
      return null; // or fetch existing MR
    }
    logger.error("Failed to create GitLab Merge Request", { input, error });
    return null;
  }
}

export async function markPullRequestReadyForReview(
    input: { owner: string; repo: string; mergeRequestIid: number;  token: string; host: string;},
): Promise<GitLabMergeRequest | null> {
  try {
    const client = new GitLabEdgeClient({host:input.host, token:input.token});
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    // 1. 获取 MR 的当前状态
    const mr = await client.getMergeRequest(projectIdOrPath, input.mergeRequestIid);
    if (!mr) {
      throw new Error("Merge Request not found.");
    }

    // 2. 检查标题，如果不是草稿，则无需操作
    if (!mr.title.toLowerCase().startsWith("draft:") && !mr.title.toLowerCase().startsWith("wip:")) {
      logger.info("Merge Request is already ready for review.", {iid: mr.iid});
      return mr;
    }

    // 3. 移除草稿前缀
    const newTitle = mr.title.replace(/^(draft:|wip:)\s*/i, "");

    // 4. 调用更新 API
    logger.info(`Marking MR #${mr.iid} as ready for review by changing title.`);
    return await client.updateMergeRequest(projectIdOrPath, input.mergeRequestIid, {title: newTitle});

  } catch (error) {
    logger.error("Failed to mark Merge Request as ready for review", {input, error});
    return null;
  }
}

export async function getBranch(
    input: { owner: string; repo: string; branchName: string;  token: string; host: string; },
): Promise<GitLabBranch | null> {
  try {
    const client = new GitLabEdgeClient({host:input.host, token:input.token});
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    return await client.getProjectBranch(projectIdOrPath, input.branchName);
  } catch (error) {
    logger.error("Failed to get GitLab branch", { input, error });
    return null;
  }
}

export async function updateIssueComment(
    input: { owner: string; repo: string; issueNumber: number; commentId: number; body: string;  token: string; host: string; },
): Promise<GitLabNote | null> {
  try {
    const client = new GitLabEdgeClient({host:input.host, token:input.token});
    const projectIdOrPath = `${input.owner}/${input.repo}`;

    return await client.updateIssueNote(projectIdOrPath, input.issueNumber, input.commentId, input.body);
  } catch (error) {
    logger.error("Failed to update GitLab issue comment", {input, error});
    return null;
  }
}