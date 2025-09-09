import { Sandbox } from "@daytonaio/sdk";
import { createLogger, LogLevel } from "../logger.js";
import { GraphConfig, TargetRepository, TaskPlan } from "@open-swe/shared/open-swe/types";
import { TIMEOUT_SEC } from "@open-swe/shared/constants";
import { getRepoAbsolutePath } from "@open-swe/shared/git";
import { ExecuteResponse } from "@daytonaio/sdk/src/types/ExecuteResponse.js";
import { addPullRequestNumberToActiveTask, getActiveTask, getPullRequestNumberFromActiveTask } from "@open-swe/shared/open-swe/tasks";
// ✨ 1. 导入 GitLab 版本的 api.ts 和认证函数
import { createPullRequest, getBranch } from "./api.js";
import { addTaskPlanToIssue } from "./issue-task.js";
import { getGitLabConfigFromConfig } from "../gitlab-tokens.js";
import { isLocalMode } from "@open-swe/shared/open-swe/local-mode";
import { createShellExecutor } from "../shell-executor/index.js";
import { getSandboxErrorFields } from "../sandbox-error-fields.js";
import { DEFAULT_EXCLUDED_PATTERNS } from "./constants.js";
import { escapeRegExp } from "../string-utils.js";

const logger = createLogger(LogLevel.INFO, "GitLab-Git");

/**
 * Parses git status output and returns an array of file paths.
 * Removes the git status indicators (first 3 characters) from each line.
 */
export function parseGitStatusOutput(gitStatusOutput: string): string[] {
  return gitStatusOutput
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => line.substring(3))
      .filter(Boolean);
}

/**
 * Validates and filters files before git add operation.
 * Excludes files/directories that should not be committed.
 */
async function getValidFilesToCommit(
    absoluteRepoDir: string,
    sandbox: Sandbox,
    config: GraphConfig,
    excludePatterns: string[] = DEFAULT_EXCLUDED_PATTERNS,
): Promise<string[]> {
  // Use unified shell executor
  const executor = createShellExecutor(config);
  const gitStatusOutput = await executor.executeCommand({
    command: "git status --porcelain",
    workdir: absoluteRepoDir,
    timeout: TIMEOUT_SEC,
    sandbox,
  });

  if (gitStatusOutput.exitCode !== 0) {
    logger.error(`Failed to get git status for file validation`, {
      gitStatusOutput,
    });
    throw new Error("Failed to get git status for file validation");
  }

  const allFiles = parseGitStatusOutput(gitStatusOutput.result);

  const validFiles = allFiles.filter((filePath) => {
    return !shouldExcludeFile(filePath, excludePatterns);
  });

  const excludedFiles = allFiles.filter((filePath) => {
    return shouldExcludeFile(filePath, excludePatterns);
  });

  if (excludedFiles.length > 0) {
    logger.info(`Excluded ${excludedFiles.length} files from commit:`, {
      excludedFiles: excludedFiles,
    });
  }

  return validFiles;
}

/**
 * Checks if a file should be excluded from commits based on patterns.
 */
export function shouldExcludeFile(
    filePath: string,
    excludePatterns: string[],
): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  return excludePatterns.some((pattern) => {
    if (pattern.includes("*")) {
      const escapedPattern = escapeRegExp(pattern);
      const regexPattern = escapedPattern.replace(/\\\*/g, ".*");
      const regex = new RegExp(
          `^${regexPattern}$|/${regexPattern}$|^${regexPattern}/|/${regexPattern}/`,
      );
      return regex.test(normalizedPath);
    }

    return (
        normalizedPath === pattern ||
        normalizedPath.startsWith(pattern + "/") ||
        normalizedPath.includes("/" + pattern + "/") ||
        normalizedPath.endsWith("/" + pattern)
    );
  });
}

export function getBranchName(configOrThreadId: GraphConfig | string): string {
  const threadId =
      typeof configOrThreadId === "string"
          ? configOrThreadId
          : configOrThreadId.configurable?.thread_id;
  if (!threadId) {
    throw new Error("No thread ID provided");
  }

  return `open-swe/${threadId}`;
}

export async function getChangedFilesStatus(
    absoluteRepoDir: string,
    sandbox: Sandbox,
    config: GraphConfig,
): Promise<string[]> {
  // Use unified shell executor
  const executor = createShellExecutor(config);
  const gitStatusOutput = await executor.executeCommand({
    command: "git status --porcelain",
    workdir: absoluteRepoDir,
    timeout: TIMEOUT_SEC,
    sandbox,
  });

  if (gitStatusOutput.exitCode !== 0) {
    logger.error(`Failed to get changed files status`, {
      gitStatusOutput,
    });
    return [];
  }

  return parseGitStatusOutput(gitStatusOutput.result);
}

export async function stashAndClearChanges(
    absoluteRepoDir: string,
    sandbox: Sandbox | null,
    config?: GraphConfig,
): Promise<ExecuteResponse | false> {
  // In local mode, we don't want to stash and clear changes
  if (config && isLocalMode(config)) {
    logger.info("Skipping stash and clear changes in local mode");
    return {
      exitCode: 0,
      result: "Skipped stash and clear in local mode",
    };
  }

  try {
    // Use unified shell executor
    const executor = createShellExecutor(config);
    const gitStashOutput = await executor.executeCommand({
      command: "git add -A && git stash && git reset --hard",
      workdir: absoluteRepoDir,
      timeout: TIMEOUT_SEC,
      sandbox: sandbox || undefined,
    });

    if (gitStashOutput.exitCode !== 0) {
      logger.error(`Failed to stash and clear changes`, {
        gitStashOutput,
      });
    }
    return gitStashOutput;
  } catch (e) {
    // Unified error handling
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to stash and clear changes`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return errorFields ?? false;
  }
}

function constructCommitMessage(): string {
  const baseCommitMessage = "Apply patch";
  const skipCiString = "[skip ci]";
  const vercelSkipCi = process.env.SKIP_CI_UNTIL_LAST_COMMIT === "true";
  if (vercelSkipCi) {
    return `${baseCommitMessage} ${skipCiString}`;
  }
  return baseCommitMessage;
}

/**
 * 检出分支、提交并推送代码，最后创建 Merge Request
 */
export async function checkoutBranchAndCommit(
    config: GraphConfig,
    targetRepository: TargetRepository,
    sandbox: Sandbox,
    options: {
      branchName?: string;
      taskPlan: TaskPlan;
      githubIssueId: number; // 继续使用此字段名存储 GitLab Issue IID
    },
): Promise<{ branchName: string; updatedTaskPlan?: TaskPlan }> {
  // ✨ 2. 获取 GitLab 的 host 和 token 用于 Git 操作
  const {  host, token } = getGitLabConfigFromConfig(config);

  const absoluteRepoDir = getRepoAbsolutePath(targetRepository);
  const branchName = options.branchName || getBranchName(config);

  logger.info(`Committing changes to branch ${branchName}`);

  const validFiles = await getValidFilesToCommit(absoluteRepoDir, sandbox, config);
  if (validFiles.length === 0) {
    logger.info("No valid files to commit after filtering");
    return { branchName, updatedTaskPlan: options.taskPlan };
  }

  await sandbox.git.add(absoluteRepoDir, validFiles);

  // ✨ 3. Git 用户名和邮箱可以设为通用值
  const userName = "Open SWE Agent";
  const userEmail = "agent@openswe.dev";
  await sandbox.git.commit(absoluteRepoDir, constructCommitMessage(), userName, userEmail);

  // ✨ 4. 使用 GitLab Token 进行推送
  // Daytona SDK 的 sandbox.git.push/pull 需要用户名和密码。
  // 对于 GitLab Token，用户名为 'oauth2'，密码为 token 本身。
  logger.info("Pushing changes to GitLab remote...");
  try {
    // Daytona/Isomorphic-Git 的 push 可能需要一个 onAuth 回调来提供凭证
    // 如果 sandbox.git.push 直接支持 user/pass，则用下面的方法
    await sandbox.git.push(absoluteRepoDir, "oauth2", token);
  } catch (pushError) {
    logger.error("Failed to push changes", { error: pushError });
    // 可以在这里添加 pull & re-push 的重试逻辑
    throw new Error("Failed to push changes to GitLab.");
  }
  logger.info("Successfully pushed changes");

  // ✨ 5. 创建 Merge Request 而不是 Pull Request
  let updatedTaskPlan: TaskPlan | undefined = options.taskPlan;
  const activeTask = getActiveTask(options.taskPlan);
  // getPullRequestNumberFromActiveTask 内部逻辑是通用的，可以继续使用
  const mrForTask = getPullRequestNumberFromActiveTask(options.taskPlan);

  if (!mrForTask) {
    logger.info("First commit detected, creating a draft Merge Request.");
    const mergeRequest = await createPullRequest({
      owner: targetRepository.owner,
      repo: targetRepository.repo,
      headBranch: branchName,
      title: `Draft: ${activeTask?.title ?? "Open SWE task"}`, // GitLab 用 'Draft:' 前缀
      body: `This is a draft MR created by Open SWE Agent.\n\nCloses #${options.githubIssueId}`,
      baseBranch: targetRepository.branch,
      host,
      token
    }); // 传递 config 以便 createMergeRequest 获取认证

    if (mergeRequest) {
      // addPullRequestNumberToActiveTask 内部逻辑是通用的，可以继续使用
      updatedTaskPlan = addPullRequestNumberToActiveTask(options.taskPlan, mergeRequest.iid); // 使用 .iid
      await addTaskPlanToIssue(
          { githubIssueId: options.githubIssueId, targetRepository },
          config,
          updatedTaskPlan,
      );
      logger.info(`Draft Merge Request created: !${mergeRequest.iid}`);
    }
  }

  logger.info("Successfully checked out & committed changes.", { commitAuthor: userName });
  return { branchName, updatedTaskPlan };
}

export async function cloneRepo(
    sandbox: Sandbox,
    targetRepository: TargetRepository,
    config: GraphConfig,
    args: {
      stateBranchName?: string;
    },
): Promise<string> {
  const { host, token } = getGitLabConfigFromConfig(config);

  const absoluteRepoDir = getRepoAbsolutePath(targetRepository);
  const cloneUrl = `${host}/${targetRepository.owner}/${targetRepository.repo}.git`;
  const branchName = args.stateBranchName || targetRepository.branch;

  try {
    logger.info("Cloning GitLab repository", { repoPath: cloneUrl, branch: branchName });

    let branchExists = false;
    if (branchName) {
      try {
        branchExists = !!(await getBranch({
          owner: targetRepository.owner,
          repo: targetRepository.repo,
          branchName,
          host,
          token,
        }));
      } catch (err) {
        branchExists = false;
      }
    }

    await sandbox.git.clone(
        cloneUrl,
        absoluteRepoDir,
        branchExists ? branchName : targetRepository.branch,
        branchExists ? undefined : targetRepository.baseCommit,
        "oauth2", // 用户名
        token, // 密码
    );

    logger.info("Successfully cloned repository");

    if (!branchName) throw new Error("Branch name is required for new branch creation.");
    if (branchExists) return branchName;

    await sandbox.git.createBranch(absoluteRepoDir, branchName);
    logger.info("Created branch locally", { branch: branchName });

    await sandbox.git.push(absoluteRepoDir, "oauth2", token);
    logger.info("Pushed new branch to remote", { branch: branchName });

    return branchName;

  } catch (error) {
    logger.error("Clone repo failed", { error });
    throw error;
  }
}


export async function pushEmptyCommit(
    targetRepository: TargetRepository,
    sandbox: Sandbox,
    config: GraphConfig,
) {
  // ✨ 2. 使用 GitLab 的认证方式
  const { token } = getGitLabConfigFromConfig(config);

  // ✨ 3. 使用通用的 Agent 用户名和邮箱
  const userName = "Open SWE Agent";
  const userEmail = "agent@openswe.dev";

  try {
    const absoluteRepoDir = getRepoAbsolutePath(targetRepository);
    const executor = createShellExecutor(config);

    // a. 设置 Git 提交者信息
    const setGitConfigRes = await executor.executeCommand({
      command: `git config user.name "${userName}" && git config user.email "${userEmail}"`,
      workdir: absoluteRepoDir,
      timeout: TIMEOUT_SEC,
    });
    if (setGitConfigRes.exitCode !== 0) {
      logger.error(`Failed to set git config`, {
        exitCode: setGitConfigRes.exitCode,
        result: setGitConfigRes.result,
      });
      return;
    }

    // b. 创建一个空的 commit
    const emptyCommitRes = await executor.executeCommand({
      command: "git commit --allow-empty -m 'Empty commit to trigger CI'",
      workdir: absoluteRepoDir,
      timeout: TIMEOUT_SEC,
    });
    if (emptyCommitRes.exitCode !== 0) {
      logger.error(`Failed to create empty commit`, {
        exitCode: emptyCommitRes.exitCode,
        result: emptyCommitRes.result,
      });
      return;
    }

    // ✨ 4. 使用 GitLab Token 进行推送
    await sandbox.git.push(
        absoluteRepoDir,
        "oauth2",     // 用户名为 'oauth2'
        token,  // 密码为 GitLab Token
    );

    logger.info("Successfully pushed empty commit");
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to push empty commit`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
  }
}

export async function pullLatestChanges(
    absoluteRepoDir: string,
    sandbox: Sandbox,
    config: GraphConfig,
): Promise<boolean> {
  try {
    const { token } = getGitLabConfigFromConfig(config);

    await sandbox.git.pull(
        absoluteRepoDir,
        "oauth2",
        token,
    );

    logger.info("Successfully pulled latest changes.");
    return true;
  } catch (e) {
    const errorFields = getSandboxErrorFields(e);
    logger.error(`Failed to pull latest changes`, {
      ...(errorFields && { errorFields }),
      ...(e instanceof Error && {
        name: e.name,
        message: e.message,
        stack: e.stack,
      }),
    });
    return false;
  }
}