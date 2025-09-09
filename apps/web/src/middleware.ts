import { NextRequest, NextResponse } from "next/server";
import {
  GITLAB_HOST_COOKIE, GITLAB_TOKEN_COOKIE,
} from "@open-swe/shared/constants";
// import { verifyGithubUser } from "@open-swe/shared/github/verify-user";
import { verifyGitlabUser } from "@open-swe/shared/gitlab/verify-user";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(GITLAB_TOKEN_COOKIE)?.value;
  const host = request.cookies.get(GITLAB_HOST_COOKIE)?.value;

  const user = token && host ? await verifyGitlabUser(token, host) : null;

  if (request.nextUrl.pathname === "/") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }
  }

  if (request.nextUrl.pathname.startsWith("/chat")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*"],
};
