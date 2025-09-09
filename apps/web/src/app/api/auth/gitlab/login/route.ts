import type { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import {GITLAB_HOST_COOKIE, GITLAB_TOKEN_COOKIE} from "@open-swe/shared/constants";
import { verifyGitlabUser } from "@open-swe/shared/gitlab/verify-user";
import {NextResponse} from "next/server";

export async function POST(
    req: NextApiRequest
) {
  try {
    const body = await req.json();
    const token = body.token
    const host = body.host

    if (!token || !host) {
      return NextResponse.json(
          { error: "Gitlab Host 和 Access Token 必填" },
          { status: 500 },
      );
    }

    const user = await verifyGitlabUser(token, host);
    if (!user) {
      return NextResponse.json(
          { error: "用户验证失败" },
          { status: 500 },
      );
    }

    const response = NextResponse.redirect(new URL("/chat", req.url));

    response.cookies.set(GITLAB_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    response.cookies.set(GITLAB_HOST_COOKIE, host, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response

  } catch (error) {
    return NextResponse.json(
        { error: error },
        { status: 500 },
    );
  }
}