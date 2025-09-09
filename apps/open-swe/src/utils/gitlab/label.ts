/**
 * 根据 NODE_ENV 返回标准的 GitLab 触发标签。
 * @returns "swe-agent::run" 或 "swe-agent::run-dev"
 */
export function getOpenSWELabel(): "swe-agent::run" | "swe-agent::run-dev" {
  return process.env.NODE_ENV === "production"
      ? "swe-agent::run"
      : "swe-agent::run-dev";
}

/**
 * 根据 NODE_ENV 返回“自动接受”模式的 GitLab 触发标签。
 * @returns "swe-agent::run-auto" 或 "swe-agent::run-auto-dev"
 */
export function getOpenSWEAutoAcceptLabel():
    | "swe-agent::run-auto"
    | "swe-agent::run-auto-dev" {
  return process.env.NODE_ENV === "production"
      ? "swe-agent::run-auto"
      : "swe-agent::run-auto-dev";
}

/**
 * 根据 NODE_ENV 返回“最大模型”模式的 GitLab 触发标签。
 * @returns "swe-agent::run-max" 或 "swe-agent::run-max-dev"
 */
export function getOpenSWEMaxLabel():
    | "swe-agent::run-max"
    | "swe-agent::run-max-dev" {
  return process.env.NODE_ENV === "production"
      ? "swe-agent::run-max"
      : "swe-agent::run-max-dev";
}

/**
 * 根据 NODE_ENV 返回“最大模型且自动接受”模式的 GitLab 触发标签。
 * @returns "swe-agent::run-max-auto" 或 "swe-agent::run-max-auto-dev"
 */
export function getOpenSWEMaxAutoAcceptLabel():
    | "swe-agent::run-max-auto"
    | "swe-agent::run-max-auto-dev" {
  return process.env.NODE_ENV === "production"
      ? "swe-agent::run-max-auto"
      : "swe-agent::run-max-auto-dev";
}