// src/webhooks/gitlab.ts

import { v4 as uuidv4 } from "uuid";
import { Context } from "hono";
import { BlankEnv, BlankInput } from "hono/types";
import { createLogger, LogLevel } from "../../utils/logger.js";
import { GitLabApp } from "../../utils/gitlab-app.js";
import { createLangGraphClient } from "../../utils/langgraph-client.js";
import {
  MANAGER_GRAPH_ID,
  OPEN_SWE_STREAM_MODE,
} from "@open-swe/shared/constants";
import { HumanMessage } from "@langchain/core/messages";
import { ManagerGraphUpdate } from "@open-swe/shared/open-swe/manager/types";
import { getOpenSweAppUrl } from "../../utils/url-helpers.js";
import { StreamMode } from "@langchain/langgraph-sdk";

const logger = createLogger(LogLevel.INFO, "GitLabIssueWebhook");

// --- MODIFICATION: Define GitLab-specific trigger labels ---
// It's good practice to namespace labels, e.g., 'swe-agent::run'
const GITLAB_TRIGGER_LABELS = [
  "swe-agent::run",
  "swe-agent::run-auto-accept",
  "swe-agent::run-max",
  "swe-agent::run-max-auto-accept",
];
const GITLAB_AUTO_ACCEPT_LABELS = [
  "swe-agent::run-auto-accept",
  "swe-agent::run-max-auto-accept",
];
const GITLAB_MAX_LABELS = [
  "swe-agent::run-max",
  "swe-agent::run-max-auto-accept",
];

const gitlabApp = new GitLabApp();

// Helper to create the same metadata comment
const createDevMetadataComment = (runId: string, threadId: string) => {
  return `<details>
  <summary>Dev Metadata</summary>
  ${JSON.stringify(
      {
        runId,
        threadId,
      },
      null,
      2,
  )}
</details>`;
};

// Main handler function for GitLab webhooks
export async function issueWebhookHandler(
    c: Context<BlankEnv, "/webhooks/gitlab", BlankInput>,
) {
  const gitlabTokenHeader = c.req.header("x-gitlab-token");
  if (!gitlabApp.verifyWebhook(gitlabTokenHeader)) {
    logger.error("Invalid GitLab webhook secret token");
    return c.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await c.req.json();

  // We only care about issue events
  if (payload.object_kind !== "issue") {
    return c.json({ received: true, message: "Not an issue event." });
  }

  // We only care about the 'update' action, which is where label changes happen
  if (payload.object_attributes?.action !== "update") {
    return c.json({ received: true, message: "Not an issue update event." });
  }

  const changes = payload.changes;
  if (!changes?.labels) {
    // If the 'labels' field didn't change, there's nothing for us to do.
    return c.json({ received: true, message: "No label changes." });
  }

  const previousLabels = changes.labels.previous.map((l: any) => l.title);
  const currentLabels = changes.labels.current.map((l: any) => l.title);
  const newlyAddedLabels = currentLabels.filter(
      (l: string) => !previousLabels.includes(l),
  );

  // Find the specific trigger label that was just added
  const triggerLabel = newlyAddedLabels.find((l: string) =>
      GITLAB_TRIGGER_LABELS.includes(l),
  );

  if (!triggerLabel) {
    return c.json({ received: true, message: "No trigger label added." });
  }

  const isAutoAcceptLabel = GITLAB_AUTO_ACCEPT_LABELS.includes(triggerLabel);
  const isMaxLabel = GITLAB_MAX_LABELS.includes(triggerLabel);

  logger.info(
      `'${triggerLabel}' label added to issue #${payload.object_attributes.iid}`,
      {
        isAutoAcceptLabel,
        isMaxLabel,
      },
  );

  try {
    const api = gitlabApp.getApi();

    const { object_attributes, project, user } = payload;
    const issueData = {
      fullRepoPath: project.path_with_namespace,
      issueIid: object_attributes.iid,
      issueTitle: object_attributes.title,
      issueBody: object_attributes.description || "",
      userId: user.id,
      userLogin: user.username,
      projectId: project.id,
      repoUrl: project.web_url, // Or project.http_url_to_repo
    };

    const langGraphClient = createLangGraphClient({});

    const threadId = uuidv4();
    const runInput: ManagerGraphUpdate = {
      messages: [
        new HumanMessage({
          id: uuidv4(),
          content: `**${issueData.issueTitle}**\n\n${issueData.issueBody}`,
        }),
      ],
      githubIssueId: issueData.issueIid,
      targetRepository: {
        // Splitting the full path to get owner and repo name
        owner: issueData.fullRepoPath.split("/")[0],
        repo: issueData.fullRepoPath.split("/").slice(1).join("/"),
      },
      autoAcceptPlan: isAutoAcceptLabel,
    };

    const config: Record<string, any> = {
      recursion_limit: 400,
    };

    if (isMaxLabel) {
      config.configurable = {
        plannerModelName: "anthropic:claude-opus-4-1",
        programmerModelName: "anthropic:claude-opus-4-1",
      };
    }

    const run = await langGraphClient.runs.create(threadId, MANAGER_GRAPH_ID, {
      input: runInput,
      config,
      ifNotExists: "create",
      streamResumable: true,
      streamMode: OPEN_SWE_STREAM_MODE as StreamMode[],
    });

    logger.info("Created new run from GitLab issue.", {
      threadId,
      runId: run.run_id,
      issueIid: issueData.issueIid,
      projectId: issueData.projectId,
      userId: issueData.userId,
      userLogin: issueData.userLogin,
      autoAcceptPlan: isAutoAcceptLabel,
    });

    // --- MODIFICATION: Post comment back to GitLab using Gitbeaker ---
    logger.info("Creating comment on GitLab issue...");
    const appUrl = getOpenSweAppUrl(threadId);
    const appUrlCommentText = appUrl
        ? `View run in Open SWE [here](${appUrl}) (this URL will only work for @${issueData.userLogin})`
        : "";

    await api.IssueNotes.create(
        issueData.projectId,
        issueData.issueIid,
        `🤖 Open SWE has been triggered for this issue. Processing...\n\n${appUrlCommentText}\n\n${createDevMetadataComment(run.run_id, threadId)}`
    );

    return c.json({ received: true, runId: run.run_id });

  } catch (error: any) {
    logger.error("Error processing GitLab webhook:", error);
    // Try to post an error comment back to the issue if possible
    try {
      const { project, object_attributes } = payload;
      const api = gitlabApp.getApi();
      await api.IssueNotes.create(project.id, object_attributes.iid, `🤖 Open SWE failed to start. Error: ${error.message}`);
    } catch (commentError) {
      logger.error("Failed to post error comment to GitLab issue:", commentError);
    }
    return c.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}