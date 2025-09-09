import { GraphConfig } from "@open-swe/shared/open-swe/types";
import {
  GITLAB_HOST_HEADER,
  GITLAB_ACCESS_TOKEN_HEADER,
  GITLAB_USER_ID_HEADER,
  GITLAB_USER_LOGIN_HEADER,
} from "@open-swe/shared/constants";

export function getDefaultHeaders(config: GraphConfig): Record<string, string> {
  const headers = config.configurable;
  if (!headers || typeof headers !== 'object') {
    throw new Error("Headers are missing in the configuration.");
  }

  const host = headers[GITLAB_HOST_HEADER];
  const token = headers[GITLAB_ACCESS_TOKEN_HEADER];

  if (!host) {
    throw new Error(`Missing or invalid header: ${GITLAB_HOST_HEADER}`);
  }
  if (!token) {
    throw new Error(`Missing or invalid header: ${GITLAB_ACCESS_TOKEN_HEADER}`);
  }

  const userId = headers[GITLAB_USER_ID_HEADER] ?? "";
  const userLogin = headers[GITLAB_USER_LOGIN_HEADER] ?? "";

  const defaultHeaders: Record<string, string> = {
    [GITLAB_HOST_HEADER]: host,
    [GITLAB_ACCESS_TOKEN_HEADER]: token,
  };

  if (userId) {
    defaultHeaders[GITLAB_USER_ID_HEADER] = userId;
  }
  if (userLogin) {
    defaultHeaders[GITLAB_USER_LOGIN_HEADER] = userLogin;
  }

  return defaultHeaders;
}