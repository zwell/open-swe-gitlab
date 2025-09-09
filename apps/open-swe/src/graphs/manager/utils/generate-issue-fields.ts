// src/graphs/manager/utils/generate-issue-fields.ts (GitLab 版本)

import { BaseMessage } from "@langchain/core/messages";
import { GraphConfig } from "@open-swe/shared/open-swe/types";
import { z } from "zod";
import {
  loadModel,
  supportsParallelToolCallsParam,
} from "../../../utils/llms/index.js"; // 保持不变
import { LLMTask } from "@open-swe/shared/open-swe/llm-task";
import { getMessageString } from "../../../utils/message/content.js"; // 保持不变

/**
 * 使用 LLM 从对话历史中自动生成 Issue 的标题和正文。
 * @param messages 对话消息数组。
 * @param configurable LangGraph 的配置对象。
 * @returns 包含 title 和 body 的对象。
 */
export async function createIssueFieldsFromMessages(
    messages: BaseMessage[],
    configurable: GraphConfig["configurable"],
): Promise<{ title: string; body: string }> {
  const model = await loadModel({ configurable }, LLMTask.ROUTER);

  const gitlabIssueTool = {
    name: "create_gitlab_issue", // 名字更新
    description: "Create a new GitLab issue with the given title and body.", // 描述更新
    schema: z.object({
      title: z
          .string()
          .describe(
              "The title of the issue to create. Should be concise and clear.",
          ),
      body: z
          .string()
          .describe(
              "The body of the issue to create. This should be an extremely concise description of the issue. You should not over-explain the issue, as we do not want to waste the user's time. Do not include any additional context not found in the conversation history.",
          ),
    }),
  };

  const modelSupportsParallelToolCallsParam = supportsParallelToolCallsParam(
      { configurable },
      LLMTask.ROUTER,
  );

  const modelWithTools = model
      .bindTools([gitlabIssueTool], {
        tool_choice: gitlabIssueTool.name, // 使用新工具名
        ...(modelSupportsParallelToolCallsParam ? { parallel_tool_calls: false } : {}),
      })
      .withConfig({ tags: ["nostream"], runName: "create-issue-fields" });

  const prompt = `You're an AI programmer, tasked with taking the conversation history provided below, and creating a new GitLab issue.
Ensure the issue title and body are both clear and concise. Do not hallucinate any information not found in the conversation history.
You should mainly be looking at the human messages as context for the issue.

# Conversation History
${messages.map(getMessageString).join("\n")}

With the above conversation history in mind, please call the ${gitlabIssueTool.name} tool to create a new GitLab issue based on the user's request.`;

  // (调用 LLM 和处理结果的逻辑保持不变)
  const result = await modelWithTools.invoke([
    {
      role: "user",
      content: prompt,
    },
  ]);
  const toolCall = result.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("No tool call found in result");
  }

  // ✨ 5. 返回的结构与 z.object 定义的 schema 一致，保持不变
  return toolCall.args as z.infer<typeof gitlabIssueTool.schema>;
}