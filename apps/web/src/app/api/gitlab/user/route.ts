import { GITLAB_TOKEN_COOKIE, GITLAB_HOST_COOKIE } from "@open-swe/shared/constants";
import { verifyGitlabUser } from "@open-swe/shared/gitlab/verify-user";
import {NextRequest, NextResponse} from "next/server";

export default async function GET(request: NextRequest) {
    const token = request.cookies.get(GITLAB_TOKEN_COOKIE)?.value;
    const host = request.cookies.get(GITLAB_HOST_COOKIE)?.value;
    if (!token || !host) {
        return NextResponse.json(
            { error: "Auth Fail" },
            { status: 401 },
        );
    }
    const user = await verifyGitlabUser(token, host);
    if (!user) {
        return NextResponse.json(
            { error: "Invalid token" },
            { status: 401 },
        );
    }

    return NextResponse.json(
        { user: user },
        { status: 200 },
    );
}