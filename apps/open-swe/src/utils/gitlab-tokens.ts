// src/utils/getGitLabConfigFromConfig.ts (新文件)

import { GraphConfig } from "@open-swe/shared/open-swe/types";
// ✨ 1. 导入 GitLab 相关的常量
import {
  GITLAB_ACCESS_TOKEN_HEADER,
  GITLAB_HOST_HEADER,
} from "@open-swe/shared/constants"; // 确保您已在常量文件中定义了 GITLAB_HOST_HEADER

/**
 * 从 LangGraph 的配置对象中安全地提取 GitLab 的 Host 和 Access Token。
 * 这些信息最初由前端提供，经过 API 代理注入到请求头，
 * 最终由 LangGraph 传递到这里的 config 对象中。
 *
 * @param config LangGraph 的运行时配置对象。
 * @returns 包含 host 和 token 的对象。
 */
export function getGitLabConfigFromConfig(config: GraphConfig): {
  host: string;
  token: string;
} {
  // 1. 检查 configurable 对象是否存在
  if (!config.configurable) {
    throw new Error("No 'configurable' object found in graph config.");
  }

  // ✨ 2. LangGraph 会将请求头自动放入 config.configurable.headers
  const headers = config.configurable;
  if (!headers || typeof headers !== 'object') {
    throw new Error("Headers are missing in the configuration.");
  }

  // 3. 从 headers 中提取 host
  // 我们约定，如果 header 中没有 host，则回退到环境变量，最后默认为 gitlab.com
  const host = headers[GITLAB_HOST_HEADER] || process.env.GITLAB_HOST || "https://gitlab.com";

  // 4. 从 headers 中提取 token
  const token = headers[GITLAB_ACCESS_TOKEN_HEADER];

  // 5. 验证 token 是否存在
  if (!token || typeof token !== 'string') {
    throw new Error(
        `Missing required GitLab token in headers under key: ${GITLAB_ACCESS_TOKEN_HEADER}`
    );
  }

  return { host, token };
}