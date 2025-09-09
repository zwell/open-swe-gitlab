import { Gitlab } from "@gitbeaker/node";

export class GitLabApp {
  api: any;

  token: string;

  constructor() {
    const host = process.env.GITLAB_HOST || "https://gitlab.com";
    const token = process.env.GITLAB_ACCESS_TOKEN;

    if (!token) {
      throw new Error("GITLAB_ACCESS_TOKEN is not configured in environment variables.");
    }

    this.token = token;

    // Instantiate the GitLab API client
    this.api = new Gitlab({
      host: host,
      token: token,
    });
  }

  public getApi(): any {
    return this.api;
  }


  public getAccessToken(): { token: string } {
    return {
      token: this.token,
    };
  }


  public verifyWebhook(receivedToken: string | undefined): boolean {
    const webhookSecret = process.env.GITLAB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // In a production environment, you might want to return false here.
      return true;
    }
    return receivedToken === webhookSecret;
  }
}