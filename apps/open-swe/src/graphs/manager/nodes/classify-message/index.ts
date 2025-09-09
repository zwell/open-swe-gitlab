import { GraphConfig } from "@open-swe/shared/open-swe/types";
import {
  ManagerGraphState,
  ManagerGraphUpdate,
} from "@open-swe/shared/open-swe/manager/types";
import { createLangGraphClient } from "../../../../utils/langgraph-client.js";
import {
  BaseMessage,
  HumanMessage,
  isHumanMessage,
  RemoveMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import {
  loadModel,
  supportsParallelToolCallsParam,
} from "../../../../utils/llms/index.js";
import { LLMTask } from "@open-swe/shared/open-swe/llm-task";
import { Command, END } from "@langchain/langgraph";
import { getMessageContentString } from "@open-swe/shared/messages";
// ✨ 1. 导入 GitLab 相关的工具和客户端
import { getGitLabConfigFromConfig } from "../../../../utils/gitlab-tokens.js";
import { GitLabEdgeClient } from "@open-swe/shared/gitlab/edge-client";
import { getPlansFromIssue as getPlansFromGitLabIssue } from "../../../../utils/gitlab/issue-task.js";
import { getDefaultHeaders as getDefaultHeaders } from "../../../../utils/default-headers.js";

// (通用工具保持不变)
import { createIssueFieldsFromMessages } from "../../utils/generate-issue-fields.js";
import {
  extractContentWithoutDetailsFromIssueBody, // This is a generic string util, can be kept
  extractIssueTitleAndContentFromMessage, // This is a generic string util, can be kept
  formatContentForIssueBody, // This is a generic string util, can be kept
} from "../../../../utils/gitlab/issue-messages.js";
import { BASE_CLASSIFICATION_SCHEMA } from "./schemas.js";
import { createLogger, LogLevel } from "../../../../utils/logger.js";
import { createClassificationPromptAndToolSchema } from "./utils.js";
import { RequestSource } from "../../../../constants.js";
import { Thread } from "@langchain/langgraph-sdk";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { Client } from "@langchain/langgraph-sdk";

const logger = createLogger(LogLevel.INFO, "ClassifyMessage");

/**
 * Classify the latest human message to determine how to route the request.
 */
export async function classifyMessage(
    state: ManagerGraphState,
    config: GraphConfig,
): Promise<Command> {
  const userMessage = state.messages.findLast(isHumanMessage);
  if (!userMessage) {
    throw new Error("No human message found.");
  }

  let plannerThread: Thread<PlannerGraphState> | undefined;
  let programmerThread: Thread<GraphState> | undefined;
  let langGraphClient: Client | undefined;
  let gitlabClient: GitLabEdgeClient | undefined; // ✨ GitLab client

  if (!isLocalMode(config)) {
    langGraphClient = createLangGraphClient({
      defaultHeaders: getDefaultHeaders(config),
    });
    const { host, token } = getGitLabConfigFromConfig(config);
    gitlabClient = new GitLabEdgeClient({ host, token });

    plannerThread = state.plannerSession?.threadId
        ? await langGraphClient.threads.get(state.plannerSession.threadId)
        : undefined;
    const plannerThreadValues = plannerThread?.values;
    programmerThread = plannerThreadValues?.programmerSession?.threadId
        ? await langGraphClient.threads.get(
            plannerThreadValues.programmerSession.threadId,
        )
        : undefined;
  }

  const programmerStatus = programmerThread?.status ?? "not_started";
  const plannerStatus = plannerThread?.status ?? "not_started";

  const issuePlans = state.githubIssueId
      ? await getPlansFromGitLabIssue(state, config)
      : null;
  const taskPlan = issuePlans?.taskPlan ?? state.taskPlan;

  const { prompt, schema } = createClassificationPromptAndToolSchema({
    programmerStatus,
    plannerStatus,
    messages: state.messages,
    taskPlan,
    proposedPlan: issuePlans?.proposedPlan ?? undefined,
    requestSource: userMessage.additional_kwargs?.requestSource as
        | RequestSource
        | undefined,
  });
  const respondAndRouteTool = {
    name: "respond_and_route",
    description: "Respond to the user's message and determine how to route it.",
    schema,
  };
  const model = await loadModel(config, LLMTask.ROUTER);
  const modelSupportsParallelToolCallsParam = supportsParallelToolCallsParam(config, LLMTask.ROUTER);
  const modelWithTools = model.bindTools([respondAndRouteTool], {
    tool_choice: respondAndRouteTool.name,
    ...(modelSupportsParallelToolCallsParam ? { parallel_tool_calls: false } : {}),
  });

  const response = await modelWithTools.invoke([
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: extractContentWithoutDetailsFromIssueBody(
          getMessageContentString(userMessage.content),
      ),
    },
  ]);

  const toolCall = response.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("No tool call found.");
  }
  const toolCallArgs = toolCall.args as z.infer<typeof BASE_CLASSIFICATION_SCHEMA>;
  // --- (LLM 分类逻辑结束) ---

  // --- (路由决策逻辑大部分保持不变) ---
  if (toolCallArgs.route === "no_op") {
    return new Command({ update: { messages: [response] }, goto: END });
  }
  if ((toolCallArgs.route as string) === "create_new_issue") {
    return new Command({ update: { messages: [response] }, goto: "create-new-session" });
  }
  if (isLocalMode(config)) {
    if (toolCallArgs.route === "start_planner" || toolCallArgs.route === "start_planner_for_followup") {
      return new Command({ update: { messages: [response] }, goto: "start-planner" });
    }
    throw new Error(`Unsupported route for local mode received: ${toolCallArgs.route}`);
  }

  // 从这里开始，我们确定需要与 GitLab 交互
  if (!gitlabClient) {
    throw new Error("GitLab client not initialized for non-local mode.");
  }

  let gitlabIssueIid = state.githubIssueId; // 继续使用 githubIssueId 字段名存储 IID
  const newMessages: BaseMessage[] = [response];
  const projectIdOrPath = `${state.targetRepository.owner}/${state.targetRepository.repo}`;

  if (!gitlabIssueIid) {
    // 如果没有 Issue，则创建一个
    const { title } = await createIssueFieldsFromMessages(state.messages, config.configurable);
    const { content: body } = extractIssueTitleAndContentFromMessage(getMessageContentString(userMessage.content));

    logger.info("Creating new GitLab issue...", { title });
    const newIssue = await gitlabClient.createIssue(projectIdOrPath, {
      title,
      description: formatContentForIssueBody(body),
    });
    if (!newIssue) throw new Error("Failed to create GitLab issue.");

    gitlabIssueIid = newIssue.iid;
    newMessages.push(
        new RemoveMessage({ id: userMessage.id ?? "" }),
        new HumanMessage({
          ...userMessage,
          additional_kwargs: { githubIssueId: gitlabIssueIid, isOriginalIssue: true },
        }),
    );
    logger.info("New GitLab issue created", { issueIid: gitlabIssueIid });
  } else if (state.messages.filter(isHumanMessage).length > 1) {
    // 如果已有 Issue，将新消息作为评论添加
    const messagesNotInIssue = state.messages.filter(isHumanMessage).filter(m => !m.additional_kwargs?.githubIssueId);

    const createCommentsPromise = messagesNotInIssue.map(async (message) => {
      logger.info("Adding new comment to GitLab issue...", { issueIid: gitlabIssueIid });
      const createdComment = await gitlabClient!.createIssueNote(
          projectIdOrPath,
          gitlabIssueIid!,
          getMessageContentString(message.content),
      );
      if (!createdComment?.id) throw new Error("Failed to create issue comment");

      newMessages.push(
          new RemoveMessage({ id: message.id ?? "" }),
          new HumanMessage({
            ...message,
            additional_kwargs: {
              githubIssueId: gitlabIssueIid,
              // ✨ 在 GitLab 模型中，我们用 comment ID
              gitlabIssueCommentId: createdComment.id,
              ...((toolCallArgs.route as string) === "start_planner_for_followup" ? { isFollowup: true } : {}),
            },
          }),
      );
      logger.info("New comment added", { issueIid: gitlabIssueIid, commentId: createdComment.id });
    });
    await Promise.all(createCommentsPromise);

    // (恢复 planner session 的逻辑保持不变)
    // ...
  }

  // --- (最终返回 Command 的逻辑基本保持不变) ---
  const commandUpdate: ManagerGraphUpdate = {
    messages: newMessages,
    ...(gitlabIssueIid ? { githubIssueId: gitlabIssueIid } : {}),
  };

  if (
      toolCallArgs.route === "start_planner" ||
      toolCallArgs.route === "start_planner_for_followup"
  ) {
    return new Command({
      update: commandUpdate,
      goto: "start-planner",
    });
  }

  // (处理其他可能的路由，如果存在的话)
  if (["update_programmer", "update_planner", "resume_and_update_planner"].includes(toolCallArgs.route as any)) {
    return new Command({ update: commandUpdate, goto: END });
  }

  throw new Error(`Invalid route: ${toolCallArgs.route}`);
}