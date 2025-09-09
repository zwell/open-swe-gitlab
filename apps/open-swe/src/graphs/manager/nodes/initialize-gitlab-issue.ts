import { v4 as uuidv4 } from "uuid";
import { GraphConfig } from "@open-swe/shared/open-swe/types";
import {
  ManagerGraphState,
  ManagerGraphUpdate,
} from "@open-swe/shared/open-swe/manager/types";
// ✨ 1. 导入新的 GitLab 认证函数
import { getGitLabConfigFromConfig } from "../../../utils/gitlab-tokens.js";
import { HumanMessage, isHumanMessage } from "@langchain/core/messages";
// ✨ 2. 导入 GitLab 客户端和共享类型
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { GitLabIssue } from "@open-swe/shared/gitlab/types";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";
import { extractTasksFromIssueContent } from "../../../utils/gitlab/issue-task.js";

function getMessageContentFromGitLabIssue(issue: GitLabIssue): string {
  return `**Issue Title:** ${issue.title}\n\n**Issue Description:**\n${issue.description || ""}`;
}

/**
 * 如果 state 中没有 HumanMessage，此函数将从 GitLab Issue 中获取信息来初始化它。
 */
export async function initializeGitlabIssue(
    state: ManagerGraphState,
    config: GraphConfig,
): Promise<ManagerGraphUpdate> {
  // 本地模式逻辑保持不变
  if (isLocalMode(config)) {
    return {};
  }

  // ✨ 3. 使用 GitLab Token 进行认证
  const {token, host} = getGitLabConfigFromConfig(config);
  const client = new GitLabEdgeClient({
    token: token,
    host: host,
  });

  let taskPlan = state.taskPlan;

  // 逻辑：如果已有消息，只更新任务计划 (保持不变)
  if (state.messages.length && state.messages.some(isHumanMessage)) {
    if (state.githubIssueId) { // 我们继续使用 githubIssueId 这个字段名来存储 GitLab Issue IID
      const projectIdOrPath = `${state.targetRepository.owner}/${state.targetRepository.repo}`;
      const issue = await client.getIssue(projectIdOrPath, state.githubIssueId);
      if (!issue) {
        throw new Error("GitLab issue not found");
      }
      if (issue.description) {
        const extractedTaskPlan = extractTasksFromIssueContent(issue.description);
        if (extractedTaskPlan) {
          taskPlan = extractedTaskPlan;
        }
      }
    }
    return { taskPlan };
  }

  // 逻辑：如果 state 为空，则从 GitLab Issue 初始化所有信息
  if (!state.githubIssueId) {
    throw new Error("GitLab issue IID not provided (in githubIssueId field)");
  }
  if (!state.targetRepository) {
    throw new Error("Target repository not provided");
  }

  const projectIdOrPath = `${state.targetRepository.owner}/${state.targetRepository.repo}`;
  // ✨ 4. 调用 GitLab 客户端获取 Issue
  const issue = await client.getIssue(projectIdOrPath, state.githubIssueId);
  if (!issue) {
    throw new Error("GitLab issue not found");
  }

  // 从 Issue body 中提取任务计划
  if (issue.description) {
    const extractedTaskPlan = extractTasksFromIssueContent(issue.description);
    if (extractedTaskPlan) {
      taskPlan = extractedTaskPlan;
    }
  }

  // ✨ 5. 创建新的 HumanMessage，内容来自 GitLab Issue
  const newMessage = new HumanMessage({
    id: uuidv4(),
    content: getMessageContentFromGitLabIssue(issue),
    additional_kwargs: {
      // 保持字段名一致，方便下游节点处理
      githubIssueId: state.githubIssueId,
      isOriginalIssue: true,
    },
  });

  return {
    messages: [newMessage],
    taskPlan,
  };
}