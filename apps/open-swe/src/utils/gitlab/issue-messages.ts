import { v4 as uuidv4 } from "uuid";
import {
  BaseMessage,
  HumanMessage,
  isHumanMessage,
} from "@langchain/core/messages";
import { GitLabIssue, GitLabNote } from "@open-swe/shared/gitlab/types";
import { GraphConfig, TargetRepository } from "@open-swe/shared/open-swe/types";
import { getGitLabConfigFromConfig } from "../gitlab-tokens.js";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";


export const DETAILS_OPEN_TAG = "<details>";
export const DETAILS_CLOSE_TAG = "</details>";
export const DEFAULT_ISSUE_TITLE = "New Open SWE Request";
export const ISSUE_TITLE_OPEN_TAG = "<open-swe-issue-title>";
export const ISSUE_TITLE_CLOSE_TAG = "</open-swe-issue-title>";
export const ISSUE_CONTENT_OPEN_TAG = "<open-swe-issue-content>";
export const ISSUE_CONTENT_CLOSE_TAG = "</open-swe-issue-content>";

export function extractIssueTitleAndContentFromMessage(content: string): {
  title: string | null;
  content: string;
} {
  let messageTitle: string | null = null;
  let messageContent = content;
  if (
      content.includes(ISSUE_TITLE_OPEN_TAG) &&
      content.includes(ISSUE_TITLE_CLOSE_TAG)
  ) {
    messageTitle = content.substring(
        content.indexOf(ISSUE_TITLE_OPEN_TAG) + ISSUE_TITLE_OPEN_TAG.length,
        content.indexOf(ISSUE_TITLE_CLOSE_TAG),
    );
  }
  if (
      content.includes(ISSUE_CONTENT_OPEN_TAG) &&
      content.includes(ISSUE_CONTENT_CLOSE_TAG)
  ) {
    messageContent = content.substring(
        content.indexOf(ISSUE_CONTENT_OPEN_TAG) + ISSUE_CONTENT_OPEN_TAG.length,
        content.indexOf(ISSUE_CONTENT_CLOSE_TAG),
    );
  }
  return { title: messageTitle, content: messageContent };
}

export function formatContentForIssueBody(body: string): string {
  return `${ISSUE_CONTENT_OPEN_TAG}${body}${ISSUE_CONTENT_CLOSE_TAG}`;
}

function extractContentFromIssueBody(body: string): string {
  if (
      !body.includes(ISSUE_CONTENT_OPEN_TAG) ||
      !body.includes(ISSUE_CONTENT_CLOSE_TAG)
  ) {
    return body;
  }

  return body.substring(
      body.indexOf(ISSUE_CONTENT_OPEN_TAG) + ISSUE_CONTENT_OPEN_TAG.length,
      body.indexOf(ISSUE_CONTENT_CLOSE_TAG),
  );
}

export function extractContentWithoutDetailsFromIssueBody(
    body: string,
): string {
  if (!body.includes(DETAILS_OPEN_TAG)) {
    return extractContentFromIssueBody(body);
  }

  const bodyWithoutDetails = extractContentFromIssueBody(
      body.split(DETAILS_OPEN_TAG)[0],
  );
  return bodyWithoutDetails.trim();
}


/**
 * 将一个 GitLab Issue 或 Note (评论) 对象转换为格式化的文本字符串。
 */
export function getMessageContentFromIssue(
    item: GitLabIssue | GitLabNote,
): string {
  if ("title" in item) { // Type guard to check if it's an Issue
    return `[original issue]\n**${item.title}**\n${extractContentFromIssueBody(String(item.description))}`;
  }
  // It's a Note (comment)
  return `[issue comment by @${item.author.username}]\n${item.body}`;
}

/**
 * 找出 GitLab Issue 中存在但 Agent 状态中没有的用户评论。
 */
export function getUntrackedComments(
    existingMessages: BaseMessage[],
    gitlabIssueIid: number,
    comments: GitLabNote[],
): BaseMessage[] {
  const humanMessages = existingMessages.filter(
      (m) => isHumanMessage(m) && !m.additional_kwargs?.isOriginalIssue,
  );

  // 过滤掉系统生成的备注，只保留用户评论
  // const userComments = comments.filter(comment => !comment.system);
  const userComments = comments;

  return userComments
      .filter(
          (c) =>
              !humanMessages.some(
                  // 使用 gitlabIssueCommentId 进行比对
                  (m) => m.additional_kwargs?.gitlabIssueCommentId === c.id,
              ),
      )
      .map(
          (c) =>
              new HumanMessage({
                id: uuidv4(),
                content: getMessageContentFromIssue(c),
                additional_kwargs: {
                  // 保持 githubIssueId 字段名以兼容 state
                  githubIssueId: gitlabIssueIid,
                  gitlabIssueCommentId: c.id, // 添加 GitLab 特定的 comment ID
                },
              }),
      );
}

type GetMissingMessagesInput = {
  messages: BaseMessage[];
  githubIssueId: number; // 仍然用这个字段名存储 GitLab Issue IID
  targetRepository: TargetRepository;
};

/**
 * 获取 GitLab Issue 上存在但 Agent 内部状态中缺失的所有消息（包括原始描述和新评论）。
 */
export async function getMissingMessages(
    input: GetMissingMessagesInput,
    config: GraphConfig,
): Promise<BaseMessage[]> {
  if (isLocalMode(config)) {
    return [];
  }

  const { host, token } = getGitLabConfigFromConfig(config);
  const client = new GitLabEdgeClient({ host, token });
  const projectIdOrPath = `${input.targetRepository.owner}/${input.targetRepository.repo}`;
  const issueIid = input.githubIssueId;

  const [issue, comments] = await Promise.all([
    client.getIssue(projectIdOrPath, issueIid),
    client.getIssueComments(projectIdOrPath, issueIid),
  ]);

  if (!issue && !comments?.length) {
    return [];
  }

  const isIssueMessageTracked = issue
      ? input.messages.some(
          (m) =>
              isHumanMessage(m) &&
              m.additional_kwargs?.isOriginalIssue &&
              m.additional_kwargs?.githubIssueId === input.githubIssueId,
      )
      : false;

  let issueMessage: HumanMessage | null = null;
  if (issue && !isIssueMessageTracked) {
    issueMessage = new HumanMessage({
      id: uuidv4(),
      content: getMessageContentFromIssue(issue),
      additional_kwargs: {
        githubIssueId: input.githubIssueId,
        isOriginalIssue: true,
      },
    });
  }

  const untrackedCommentMessages = comments?.length
      ? getUntrackedComments(input.messages, input.githubIssueId, comments)
      : [];

  return [...(issueMessage ? [issueMessage] : []), ...untrackedCommentMessages];
}