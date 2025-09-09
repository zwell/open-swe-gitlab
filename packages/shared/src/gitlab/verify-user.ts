import { GitLabEdgeClient } from "./edge-client.js";

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  state: 'active' | 'blocked' | 'deactivated';
  avatar_url: string;
  web_url: string;
  created_at: string; // ISO 时间字符串
  bio?: string;
  location?: string;
  public_email?: string;
  skype?: string;
  linkedin?: string;
  twitter?: string;
  website_url?: string;
  organization?: string;
  job_title?: string;
  bot: boolean;
  theme_id?: number;
  color_scheme_id?: number;
  projects_limit?: number;
  current_sign_in_at?: string;
  can_create_group: boolean;
  can_create_project: boolean;
  two_factor_enabled: boolean;
  external: boolean;
  private_profile: boolean;
  commit_email?: string;
  shared_runners_minutes_limit?: number;
  extra_shared_runners_minutes_limit?: number | null;
  [key: string]: any;
}

export async function verifyGitlabUser(token: string, host: string): Promise<GitLabUser | undefined> {
  if (!token || !host) {
    return undefined;
  }

  try {
    const client = new GitLabEdgeClient({ token, host });
    const user = await client.getCurrentUser();

    // Check if the response contains a valid user object
    if (user && user.id) {
      return user;
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
