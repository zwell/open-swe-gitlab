import { v4 as uuidv4 } from "uuid";
import { GraphConfig } from "@open-swe/shared/open-swe/types";
import {
  ManagerGraphState,
  ManagerGraphUpdate,
} from "@open-swe/shared/open-swe/manager/types";
import { createIssueFieldsFromMessages } from "../utils/generate-issue-fields.js";
import {
  LOCAL_MODE_HEADER,
  MANAGER_GRAPH_ID,
  OPEN_SWE_STREAM_MODE,
} from "@open-swe/shared/constants";
import { createLangGraphClient } from "../../../utils/langgraph-client.js";
import { createIssue } from "../../../utils/gitlab/api.js";
import { getGitLabConfigFromConfig } from "../../../utils/gitlab-tokens.js";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ISSUE_TITLE_CLOSE_TAG,
  ISSUE_TITLE_OPEN_TAG,
  ISSUE_CONTENT_CLOSE_TAG,
  ISSUE_CONTENT_OPEN_TAG,
  formatContentForIssueBody,
} from "../../../utils/gitlab/issue-messages.js";
import { getBranchName } from "../../../utils/gitlab/git.js";
import { getDefaultHeaders } from "../../../utils/default-headers.js";
import { getCustomConfigurableFields } from "../../../utils/config.js";
import { StreamMode } from "@langchain/langgraph-sdk";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";

/**
 * Create new manager session.
 * This node will extract the issue title & body from the conversation history,
 * create a new issue with those fields, then start a new manager session to
 * handle the user's new request/GitHub issue.
 */
export async function createNewSession(
  state: ManagerGraphState,
  config: GraphConfig,
): Promise<ManagerGraphUpdate> {
  const titleAndContent = await createIssueFieldsFromMessages(
    state.messages,
    config.configurable,
  );
  const { token, host } = getGitLabConfigFromConfig(config);
  const newIssue = await createIssue({
    owner: state.targetRepository.owner,
    repo: state.targetRepository.repo,
    title: titleAndContent.title,
    body: formatContentForIssueBody(titleAndContent.body),
    token,
    host,
  });
  if (!newIssue) {
    throw new Error("Failed to create new issue");
  }

  const inputMessages: BaseMessage[] = [
    new HumanMessage({
      id: uuidv4(),
      content: `${ISSUE_TITLE_OPEN_TAG}
  ${titleAndContent.title}
${ISSUE_TITLE_CLOSE_TAG}

${ISSUE_CONTENT_OPEN_TAG}
  ${titleAndContent.body}
${ISSUE_CONTENT_CLOSE_TAG}`,
      additional_kwargs: {
        githubIssueId: newIssue.number,
        isOriginalIssue: true,
      },
    }),
    new AIMessage({
      id: uuidv4(),
      content:
        "I've successfully created a new GitHub issue for your request, and started a planning session for it!",
    }),
  ];

  const isLocal = isLocalMode(config);
  const defaultHeaders = isLocal
    ? { [LOCAL_MODE_HEADER]: "true" }
    : getDefaultHeaders(config);

  const langGraphClient = createLangGraphClient({
    defaultHeaders,
  });

  const newManagerThreadId = uuidv4();
  const commandUpdate: ManagerGraphUpdate = {
    githubIssueId: newIssue.id,
    targetRepository: state.targetRepository,
    messages: inputMessages,
    branchName: state.branchName ?? getBranchName(config),
  };
  await langGraphClient.runs.create(newManagerThreadId, MANAGER_GRAPH_ID, {
    input: {},
    command: {
      update: commandUpdate,
      goto: "start-planner",
    },
    config: {
      recursion_limit: 400,
      configurable: getCustomConfigurableFields(config),
    },
    ifNotExists: "create",
    streamResumable: true,
    streamMode: OPEN_SWE_STREAM_MODE as StreamMode[],
  });

  return {
    messages: [
      new AIMessage({
        id: uuidv4(),
        content: `Success! I just created a new session for your request. Thread ID: \`${newManagerThreadId}\`

Click [here](/chat/${newManagerThreadId}) to view the thread.`,
      }),
    ],
  };
}
