import { Hono } from "hono";
// import { issueWebhookHandler } from "./github/issue-webhook.js";
import { issueWebhookHandler as gitlabIssueWebhookHandler } from "./gitlab/issue-webhook.js";

export const app = new Hono();

// app.post("/webhooks/github", issueWebhookHandler);

app.post("/webhooks/gitlab", gitlabIssueWebhookHandler);
