// src/utils/gitlab/plan.ts (新文件)

import { GraphConfig, TargetRepository } from "@open-swe/shared/open-swe/types";
// ✨ 1. 导入 GitLab 版本的认证函数和 API 工具
import { getGitLabConfigFromConfig } from "../gitlab-tokens.js";
import {
  createIssueComment, // 我们之前创建的 api.ts 中应该有这个
  getIssueComments,   // 和这个
  updateIssueComment, // 以及这个 (需要新建)
} from "./api.js";
import { createLogger, LogLevel } from "../logger.js";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";

const logger = createLogger(LogLevel.INFO, "GitLabPlan");


const PLAN_MESSAGE_OPEN_TAG = "<open-swe-plan-message>";
const PLAN_MESSAGE_CLOSE_TAG = "</open-swe-plan-message>";

function formatBodyWithPlanMessage(body: string, message: string): string {
  if (
      body.includes(PLAN_MESSAGE_OPEN_TAG) &&
      body.includes(PLAN_MESSAGE_CLOSE_TAG)
  ) {
    const bodyBeforeTag = body.split(PLAN_MESSAGE_OPEN_TAG)[0];
    const bodyAfterTag = body.split(PLAN_MESSAGE_CLOSE_TAG)[1];
    const newInnerContents = `\n${PLAN_MESSAGE_OPEN_TAG}\n\n${message}\n\n${PLAN_MESSAGE_CLOSE_TAG}\n`;
    return `${bodyBeforeTag}${newInnerContents}${bodyAfterTag}`;
  }

  return `${body}\n${PLAN_MESSAGE_OPEN_TAG}\n\n${message}\n\n${PLAN_MESSAGE_CLOSE_TAG}`;
}

export function cleanTaskItems(taskItem: string): string {
  return "```\n" + taskItem.replace("```", "\\```") + "\n```";
}

export async function postIssueComment(input: {
  githubIssueId: number;
  targetRepository: TargetRepository;
  commentBody: string;
  config: GraphConfig;
}): Promise<void> {
  const { githubIssueId, targetRepository, commentBody, config } = input;

  if (isLocalMode(config)) {
    logger.info("Skipping GitLab comment posting in local mode");
    return;
  }

  const { user } = await getGitLabAuthenticatedUser(config);
  if (!user) {
    logger.warn("Could not identify current agent user from token. Comment matching may be inaccurate.");
    // 即使无法获取当前用户，我们仍然可以继续，但无法更新评论
  }
  const agentUsername = user?.username;

  try {
    const { host, token } = getGitLabConfigFromConfig(config);
    const existingComments = await getIssueComments({
      owner: targetRepository.owner,
      repo: targetRepository.repo,
      issueNumber: githubIssueId,
      filterBotComments: false, // 我们需要所有评论来查找自己的
      token,
      host,
    });

    const existingOpenSWEComment = existingComments?.findLast(
        (c) => c.author.username === agentUsername
    );

    if (!existingOpenSWEComment) {
      // 如果不存在，创建新评论
      await createIssueComment({
        owner: targetRepository.owner,
        repo: targetRepository.repo,
        issueNumber: githubIssueId,
        body: commentBody,
        host,
        token,
      });
      logger.info(`Posted comment to GitLab issue #${githubIssueId}`);
      return;
    }

    // 如果存在，更新评论
    const newCommentBody = formatBodyWithPlanMessage(
        existingOpenSWEComment.body ?? "",
        commentBody,
    );
    await updateIssueComment({
      owner: targetRepository.owner,
      repo: targetRepository.repo,
      issueNumber: githubIssueId, // GitLab 更新评论需要 issue IID
      commentId: existingOpenSWEComment.id,
      body: newCommentBody,
      host,
      token,
    });

    logger.info(`Updated comment on GitLab issue #${githubIssueId}`);
  } catch (error) {
    logger.error("Failed to post GitLab comment:", { error });
  }
}

async function getGitLabAuthenticatedUser(config: GraphConfig) {
  try {
    const { host, token } = getGitLabConfigFromConfig(config);
    const client = new GitLabEdgeClient({ host, token });
    return { user: await client.getCurrentUser() };
  } catch {
    return { user: null };
  }
}