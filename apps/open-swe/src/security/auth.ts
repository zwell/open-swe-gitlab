import { Auth, HTTPException } from "@langchain/langgraph-sdk/auth";
import { verifyGitlabUser } from "../utils/gitlab/verify-user.js";
import {
    GITLAB_ACCESS_TOKEN_HEADER, GITLAB_HOST_HEADER, // Example: "x-gitlab-token-auth"
    GITLAB_USER_ID_HEADER,      // Example: "x-gitlab-user-id"
    GITLAB_USER_LOGIN_HEADER,   // Example: "x-gitlab-user-login"
    LOCAL_MODE_HEADER,
} from "@open-swe/shared/constants";
import { createWithOwnerMetadata, createOwnerFilter } from "./utils.js";
import { LANGGRAPH_USER_PERMISSIONS } from "../constants.js";
import { validateApiBearerToken } from "./custom.js";

// TODO: Export from LangGraph SDK
export interface BaseAuthReturn {
    is_authenticated?: boolean;
    display_name?: string;
    identity: string;
    permissions: string[];
}

// --- MODIFICATION: Metadata can be simpler for GitLab ---
interface AuthenticateReturn extends BaseAuthReturn {
    metadata: {
        // The concept of "installation_name" doesn't directly map.
        // We can use project/group path or just a generic identifier.
        installation_name: string;
    };
}

export const auth = new Auth()
    .authenticate<AuthenticateReturn>(async (request: Request) => {
        // --- KEPT: Generic CORS preflight check ---
        if (request.method === "OPTIONS") {
            return {
                identity: "anonymous",
                permissions: [],
                is_authenticated: false,
                display_name: "CORS Preflight",
                metadata: { installation_name: "n/a" },
            };
        }

        // --- KEPT: Generic Local Mode check ---
        const localModeHeader = request.headers.get(LOCAL_MODE_HEADER);
        if (localModeHeader === "true" && process.env.OPEN_SWE_LOCAL_MODE === "true") {
            return {
                identity: "local-user",
                is_authenticated: true,
                display_name: "Local User",
                metadata: { installation_name: "local-mode" },
                permissions: LANGGRAPH_USER_PERMISSIONS,
            };
        }

        // --- KEPT: Generic Bearer token auth (for custom API keys) ---
        const authorizationHeader = request.headers.get("authorization");
        if (authorizationHeader?.toLowerCase().startsWith("bearer ")) {
            const token = authorizationHeader.slice(7).trim();
            const user = validateApiBearerToken(token); // Assuming this is a generic validator
            if (user) return user;
            throw new HTTPException(401, { message: "Invalid API token" });
        }

        // --- NEW: GitLab Webhook Authentication ---
        const gitlabWebhookToken = request.headers.get("x-gitlab-token");
        if (gitlabWebhookToken && gitlabWebhookToken === process.env.GITLAB_WEBHOOK_SECRET) {
            // This request comes from our own webhook handler, which we trust.
            // It should contain user info in headers.
            const userId = request.headers.get(GITLAB_USER_ID_HEADER);
            const userLogin = request.headers.get(GITLAB_USER_LOGIN_HEADER);
            if (!userId || !userLogin) {
                throw new HTTPException(401, { message: "Webhook request missing user headers" });
            }
            return {
                identity: userId,
                is_authenticated: true,
                display_name: userLogin,
                metadata: { installation_name: "gitlab-webhook" },
                permissions: LANGGRAPH_USER_PERMISSIONS,
            };
        }

        const token = request.headers.get(GITLAB_ACCESS_TOKEN_HEADER);
        const host = request.headers.get(GITLAB_HOST_HEADER);
        if (host && token) {
            const user = await verifyGitlabUser(host, token);
            if (!user) {
                throw new HTTPException(401, { message: "Invalid GitLab PAT" });
            }
            return user
        }

        // If none of the above authentication methods match, deny access.
        throw new HTTPException(401, { message: "Authentication failed. No valid credentials provided." });
    })
    // --- KEPT: All authorization rules remain unchanged as they are generic ---
    .on("threads:create", ({ value, user }) => createWithOwnerMetadata(value, user))
    .on("threads:create_run", ({ value, user }) => createWithOwnerMetadata(value, user))
    .on("threads:read", ({ user }) => createOwnerFilter(user))
    .on("threads:update", ({ user }) => createOwnerFilter(user))
    .on("threads:delete", ({ user }) => createOwnerFilter(user))
    .on("threads:search", ({ user }) => createOwnerFilter(user))
    .on("assistants:create", ({ value, user }) => createWithOwnerMetadata(value, user))
    .on("assistants:read", ({ user }) => createOwnerFilter(user))
    .on("assistants:update", ({ user }) => createOwnerFilter(user))
    .on("assistants:delete", ({ user }) => createOwnerFilter(user))
    .on("assistants:search", ({ user }) => createOwnerFilter(user))
    .on("store", ({ user }) => ({ owner: user.identity }));