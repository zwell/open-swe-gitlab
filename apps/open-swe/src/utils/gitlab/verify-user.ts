import { Gitlab } from "@gitbeaker/node";
import {LANGGRAPH_USER_PERMISSIONS} from "../../constants.js";

export interface GitLabUser {
    identity: string;
    is_authenticated: boolean;
    display_name: string;
    metadata: {
        installation_name: string;
    };
    permissions: string[];
}

export async function verifyGitlabUser(host: string, token: string): Promise<GitLabUser | undefined> {
    if (!token) {
        return undefined;
    }

    try {
        // Dynamically create a temporary Gitlab client instance
        // authenticated WITH THE USER'S TOKEN. This is the key fix.
        const tempApi = new Gitlab({
            host: host,
            token: token,
        });

        // A simple API call to /user will succeed if the token is valid.
        const user = await tempApi.Users.current();

        // Check if the response contains a valid user object
        if (user && user.id) {
            return {
                identity: user.id.toString(),
                is_authenticated: true,
                display_name: user.name,
                metadata: {
                    installation_name: "",
                },
                permissions: LANGGRAPH_USER_PERMISSIONS,
            };
        }

        return undefined;
    } catch (error) {
        String(error)
        // Any API error (like 401 Unauthorized) will be caught here,
        // indicating the token is invalid.
        // We can log this for debugging but should return undefined to the caller.
        // console.error("GitLab token verification failed:", error);
        return undefined;
    }
}