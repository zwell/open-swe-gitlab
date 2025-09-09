// src/utils/gitlab/issue-task.ts (新文件)

import {
  GraphConfig,
  TargetRepository,
  TaskPlan,
} from "@open-swe/shared/open-swe/types";
// ✨ 1. 导入我们新的 GitLab 认证函数和客户端
import { getGitLabConfigFromConfig } from "../gitlab-tokens.js";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { createLogger, LogLevel } from "../logger.js";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";

const logger = createLogger(LogLevel.INFO, "IssueTaskString");


export const TASK_OPEN_TAG = "<open-swe-do-not-edit-task-plan>";
export const TASK_CLOSE_TAG = "</open-swe-do-not-edit-task-plan>";
export const PROPOSED_PLAN_OPEN_TAG = "<open-swe-do-not-edit-proposed-plan>";
export const PROPOSED_PLAN_CLOSE_TAG = "</open-swe-do-not-edit-proposed-plan>";
export const DETAILS_OPEN_TAG = "<details>";
export const DETAILS_CLOSE_TAG = "</details>";
const AGENT_CONTEXT_DETAILS_SUMMARY = "<summary>Agent Context</summary>";

function typeNarrowTaskPlan(taskPlan: unknown): taskPlan is TaskPlan {
  return !!(
      typeof taskPlan === "object" &&
      !Array.isArray(taskPlan) &&
      taskPlan &&
      "tasks" in taskPlan &&
      Array.isArray(taskPlan.tasks) &&
      "activeTaskIndex" in taskPlan &&
      typeof taskPlan.activeTaskIndex === "number"
  );
}

export function extractTasksFromIssueContent(content: string): TaskPlan | null {
  if (!content.includes(TASK_OPEN_TAG) || !content.includes(TASK_CLOSE_TAG)) {
    return null;
  }
  const taskPlanString = content
      .split(TASK_OPEN_TAG)?.[1]
      ?.split(TASK_CLOSE_TAG)?.[0];
  try {
    const parsedTaskPlan = JSON.parse(taskPlanString.trim());
    if (!typeNarrowTaskPlan(parsedTaskPlan)) {
      throw new Error("Invalid task plan parsed.");
    }
    return parsedTaskPlan;
  } catch (e) {
    logger.error("Failed to parse task plan", {
      taskPlanString,
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return null;
  }
}

function extractProposedPlanFromIssueContent(content: string): string[] | null {
  if (
      !content.includes(PROPOSED_PLAN_OPEN_TAG) ||
      !content.includes(PROPOSED_PLAN_CLOSE_TAG)
  ) {
    return null;
  }
  const proposedPlanString = content
      .split(PROPOSED_PLAN_OPEN_TAG)?.[1]
      ?.split(PROPOSED_PLAN_CLOSE_TAG)?.[0];
  try {
    const parsedProposedPlan = JSON.parse(proposedPlanString.trim());
    return parsedProposedPlan;
  } catch (e) {
    logger.error("Failed to parse proposed plan", {
      proposedPlanString,
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return null;
  }
}

type GetIssueTaskPlanInput = {
  githubIssueId: number; // 继续使用此字段名来存储 GitLab Issue IID
  targetRepository: TargetRepository;
};

export async function getPlansFromIssue(
    input: GetIssueTaskPlanInput,
    config: GraphConfig,
): Promise<{
  taskPlan: TaskPlan | null;
  proposedPlan: string[] | null;
}> {
  if (isLocalMode(config)) {
    return { taskPlan: null, proposedPlan: null };
  }

  // ✨ 2. 使用 GitLab 的认证和客户端
  const { host, token } = getGitLabConfigFromConfig(config);
  const client = new GitLabEdgeClient({ host, token });

  const projectIdOrPath = `${input.targetRepository.owner}/${input.targetRepository.repo}`;
  const issueIid = input.githubIssueId;

  const issue = await client.getIssue(projectIdOrPath, issueIid);

  if (!issue || !issue.description) { // GitLab 使用 'description' 字段
    throw new Error("No issue found or issue has no description.");
  }

  const taskPlan = extractTasksFromIssueContent(issue.description);
  const proposedPlan = extractProposedPlanFromIssueContent(issue.description);

  return { taskPlan, proposedPlan };
}

export async function addProposedPlanToIssue(
    input: GetIssueTaskPlanInput,
    config: GraphConfig,
    proposedPlan: string[],
) {
  // ✨ 3. 重复使用 GitLab 的认证和客户端
  const { host, token } = getGitLabConfigFromConfig(config);
  const client = new GitLabEdgeClient({ host, token });

  const projectIdOrPath = `${input.targetRepository.owner}/${input.targetRepository.repo}`;
  const issueIid = input.githubIssueId;

  const issue = await client.getIssue(projectIdOrPath, issueIid);
  if (!issue) {
    throw new Error("No issue found when attempting to add proposed plan.");
  }

  const proposedPlanString = JSON.stringify(proposedPlan, null, 2);
  const newBody = insertPlanToIssueBody(
      issue.description || "", // 使用 issue.description
      proposedPlanString,
      "proposedPlan",
  );

  // ✨ 4. 调用 GitLab 更新 Issue 的方法
  // (需要在 GitLabEdgeClient 中添加 updateIssue 方法)
  await client.updateIssue(projectIdOrPath, issueIid, { description: newBody });
}

export async function addTaskPlanToIssue(
    input: GetIssueTaskPlanInput,
    config: GraphConfig,
    taskPlan: TaskPlan,
): Promise<void> {
  // ✨ 5. 再次重复使用 GitLab 的认证和客户端
  const { host, token } = getGitLabConfigFromConfig(config);
  const client = new GitLabEdgeClient({ host, token });

  const projectIdOrPath = `${input.targetRepository.owner}/${input.targetRepository.repo}`;
  const issueIid = input.githubIssueId;

  const issue = await client.getIssue(projectIdOrPath, issueIid);
  if (!issue) {
    throw new Error("No issue found when attempting to add task plan.");
  }

  const taskPlanString = JSON.stringify(taskPlan, null, 2);
  const newBody = insertPlanToIssueBody(issue.description || "", taskPlanString, "taskPlan");

  // ✨ 6. 再次调用 GitLab 更新 Issue 的方法
  await client.updateIssue(projectIdOrPath, issueIid, { description: newBody });
}

function insertPlanToIssueBody(
    issueBody: string,
    planString: string,
    planType: "taskPlan" | "proposedPlan",
) {
  const openingPlanTag =
      planType === "taskPlan" ? TASK_OPEN_TAG : PROPOSED_PLAN_OPEN_TAG;
  const closingPlanTag =
      planType === "taskPlan" ? TASK_CLOSE_TAG : PROPOSED_PLAN_CLOSE_TAG;

  const wrappedPlan = `${openingPlanTag}
${planString}
${closingPlanTag}`;

  if (
      !issueBody.includes(openingPlanTag) &&
      !issueBody.includes(closingPlanTag)
  ) {
    if (
        !issueBody.includes(DETAILS_OPEN_TAG) &&
        !issueBody.includes(DETAILS_CLOSE_TAG)
    ) {
      return `${issueBody}
${DETAILS_OPEN_TAG}
${AGENT_CONTEXT_DETAILS_SUMMARY}
${wrappedPlan}
${DETAILS_CLOSE_TAG}`;
    } else {
      // No plan present yet, but details already exists.
      const contentBeforeDetailsTag = issueBody.split(DETAILS_OPEN_TAG)?.[0];
      const contentAfterDetailsOpenTag =
          issueBody.split(DETAILS_OPEN_TAG)?.[1] || "";
      const contentAfterSummary = contentAfterDetailsOpenTag.includes(
          AGENT_CONTEXT_DETAILS_SUMMARY,
      )
          ? contentAfterDetailsOpenTag.split(AGENT_CONTEXT_DETAILS_SUMMARY)[1]
          : contentAfterDetailsOpenTag;
      const contentAfterDetailsCloseTag =
          issueBody.split(DETAILS_CLOSE_TAG)?.[1] || "";

      return `${contentBeforeDetailsTag}${DETAILS_OPEN_TAG}
${AGENT_CONTEXT_DETAILS_SUMMARY}
${wrappedPlan}${
          contentAfterSummary.trim()
              ? `
${contentAfterSummary.trim()}`
              : ""
      }
${DETAILS_CLOSE_TAG}${contentAfterDetailsCloseTag}`;
    }
  } else {
    const contentBeforeOpenTag = issueBody.split(openingPlanTag)?.[0];
    const contentAfterCloseTag = issueBody.split(closingPlanTag)?.[1];

    return `${contentBeforeOpenTag}
${wrappedPlan}
${contentAfterCloseTag}`;
  }
}