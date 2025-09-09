import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
// ✨ 1. 导入 GitLab 相关的常量和新的辅助函数
import {
    GITLAB_ACCESS_TOKEN_HEADER,
    GITLAB_HOST_HEADER,
    GITLAB_TOKEN_COOKIE,
    GITLAB_HOST_COOKIE,
    GITLAB_USER_ID_HEADER, GITLAB_USER_LOGIN_HEADER
} from "@open-swe/shared/constants";
import { encryptSecret } from "@open-swe/shared/crypto";
import {verifyGitlabUser} from "@open-swe/shared/gitlab/verify-user";
import {NextResponse} from "next/server";

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
    initApiPassthrough({
      apiUrl: process.env.LANGGRAPH_API_URL ?? "http://localhost:2024",
      runtime: "edge",
      disableWarningLog: true,

      bodyParameters: (req, body) => {
        if (body.config?.configurable && "apiKeys" in body.config.configurable) {
          const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
          if (!encryptionKey) {
            throw new Error("SECRETS_ENCRYPTION_KEY environment variable is required");
          }
          const apiKeys = body.config.configurable.apiKeys;
          const encryptedApiKeys: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(apiKeys)) {
            if (typeof value === "string" && value.trim() !== "") {
              encryptedApiKeys[key] = encryptSecret(value, encryptionKey);
            } else {
              encryptedApiKeys[key] = value;
            }
          }
          body.config.configurable.apiKeys = encryptedApiKeys;
          return body;
        }
        return body;
      },

      headers: async (req) => {
        const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
        if (!encryptionKey) {
          throw new Error("SECRETS_ENCRYPTION_KEY environment variable is required");
        }

        const token = req.cookies.get(GITLAB_TOKEN_COOKIE)?.value??"";
        const host = req.cookies.get(GITLAB_HOST_COOKIE)?.value??"";

          const headersToForward: Record<string, string> = {
              "Content-Type": "application/json",
              [GITLAB_ACCESS_TOKEN_HEADER]: token,
              [GITLAB_HOST_HEADER]: host,
          };

          try {
              const user = await verifyGitlabUser(token, host);
              if (user) {
                  if (user.id) {
                      headersToForward[GITLAB_USER_ID_HEADER] = user.id.toString(); // 转换为字符串
                  }
                  if (user.username) {
                      headersToForward[GITLAB_USER_LOGIN_HEADER] = user.username; // 使用 username，通常是必填的
                  }
              }
          } catch (error) {
              console.warn("Could not verify user in API proxy, forwarding with basic auth headers.", error);
          }

          return headersToForward;
      },
    });