import { NextRequest, NextResponse } from "next/server";
import { verifyGitlabUser } from "@open-swe/shared/gitlab/verify-user";
import {GITLAB_HOST_COOKIE, GITLAB_TOKEN_COOKIE} from "@open-swe/shared/constants";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(GITLAB_TOKEN_COOKIE)?.value;
    const host = request.cookies.get(GITLAB_HOST_COOKIE)?.value;
    if (!token || !host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = await verifyGitlabUser(token, host);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid GitHub token" },
        { status: 401 },
      );
    }
    // Only return safe fields
    return NextResponse.json({
      user: {
        login: user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch user info" },
      { status: 500 },
    );
  }
}
