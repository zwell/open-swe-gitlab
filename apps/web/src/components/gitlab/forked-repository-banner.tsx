"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
// ✨ 1. 导入我们的 GitLab Provider Hook
import { useGitLabAppProvider } from "@/providers/GitLabApp";

// ✨ 2. GitLab 的文档链接
const GITLAB_DOCS_LINK_ENABLING_ISSUES =
    "https://docs.gitlab.com/ee/user/project/settings/#sharing-and-permissions";

export function IssuesRequiredBanner() {
  // ✨ 3. 从 GitLab Provider 获取状态
  const { selectedProject, projects } = useGitLabAppProvider();

  // ✨ 4. 逻辑基本不变，只是变量名和属性名变了
  const currentProject = projects.find(
      (project) => selectedProject && project.id === selectedProject.id,
  );

  // 如果项目已启用 issues (或未选择项目/找不到项目)，则不显示横幅
  // GitLab 项目默认启用 Issues, 所以 issues_enabled 可能为 undefined, 我们视其为 true
  if (
      !selectedProject ||
      !currentProject ||
      currentProject.issues_enabled !== false // 只有明确为 false 时才算禁用
  ) {
    return null;
  }

  // 如果 issues 被禁用了，显示警告
  return (
      <Alert
          variant="warning"
          className="relative my-4" // 加一点边距
      >
        <AlertTriangle className="h-4 w-4" />
        {/* ✨ 5. 更新文本内容 ✨ */}
        <AlertTitle>Issues Must Be Enabled</AlertTitle>
        <AlertDescription>
          <p>
            Open SWE requires the Issues feature to be enabled on the project.
            Please enable it to proceed.
          </p>
          <p>
            You can enable Issues in your project's "Settings &gt; General &gt;
            Visibility, project features, permissions". See{" "}
            <a
                className="font-semibold underline underline-offset-2"
                href={GITLAB_DOCS_LINK_ENABLING_ISSUES}
                target="_blank"
                rel="noopener noreferrer"
            >
              here
            </a>{" "}
            for the official GitLab documentation.
          </p>
        </AlertDescription>
      </Alert>
  );
}