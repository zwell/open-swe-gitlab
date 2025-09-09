"use client";

import { memo } from "react";
import { differenceInHours, differenceInMinutes, format } from "date-fns";
import { GitBranch, ArrowRight, ListTodo } from "lucide-react";
import { useThreadsContext } from "@/providers/Thread";
import { cn } from "@/lib/utils";
import { StatusIndicator } from "@/components/status-indicator";
import { GitLabSVG } from "./icons/gitlab";
import { useQueryState } from "nuqs";
import { Thread } from "@langchain/langgraph-sdk";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { getThreadTasks, getThreadTitle } from "@/lib/thread";

interface ThreadItemProps {
  thread: Thread<GraphState>;
  onClick: (thread: Thread<GraphState>) => void;
  variant?: "sidebar" | "dashboard";
  className?: string;
}

// 这个日期格式化函数是平台无关的，保持不变
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const minutesAgo = differenceInMinutes(now, date);
  const hoursAgo = differenceInHours(now, date);

  if (minutesAgo < 60) {
    return `${minutesAgo} min ago`;
  }
  if (hoursAgo < 24) {
    return `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
  }
  return format(date, "MMM d"); // 使用 'MMM d' 更常见
}

export const ThreadItem = memo(function ThreadItem({
                                                     thread,
                                                     onClick,
                                                     variant = "dashboard",
                                                     className,
                                                   }: ThreadItemProps) {
  // --- 所有 Hooks 和状态变量都与平台无关，保持不变 ---
  const [threadId] = useQueryState("threadId");
  const { recentlyUpdatedThreads } = useThreadsContext();
  const isSelected = thread.thread_id === threadId;
  const isSidebar = variant === "sidebar";
  const isRecentlyUpdated = recentlyUpdatedThreads.has(thread.thread_id);

  const displayDate = formatRelativeDate(thread.created_at);
  const { totalTasks, completedTasks } = getThreadTasks(thread);

  // --- 从线程数据中提取项目信息 ---
  const projectOwner = thread.values?.targetRepository?.owner ?? "unknown";
  const projectName = thread.values?.targetRepository?.repo ?? "repository";
  // 组合成 GitLab 风格的完整路径
  const projectFullName = `${projectOwner}/${projectName}`;
  const projectBranch = thread.values?.targetRepository?.branch || "main";

  return (
      <div
          className={cn(
              "group cursor-pointer rounded-lg border bg-background p-3 shadow-sm transition-all hover:bg-muted/50 hover:shadow-md",
              isSelected && "border-primary ring-1 ring-primary",
              isRecentlyUpdated && "animate-pulse border-blue-300 bg-blue-50/50",
              className,
          )}
          onClick={() => {
            if (!isSelected) {
              onClick(thread);
            }
          }}
      >
        <div className="flex items-start gap-2">
          <div className="flex w-full min-w-0 flex-col gap-1.5">
            {/* 状态和标题部分保持不变 */}
            <div className="flex w-full items-center gap-2">
              <StatusIndicator status={thread.status} />
              <h4 className="truncate text-sm font-semibold leading-tight text-foreground">
                {getThreadTitle(thread)}
              </h4>
            </div>

            {/* ✨ 2. 这是唯一被修改的显示逻辑部分 ✨ */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {/* GitLab 项目信息 */}
              <div className="flex items-center gap-1.5">
                <GitLabSVG
                    width="14"
                    height="14"
                    className="flex-shrink-0 text-gray-500"
                />
                <span className="max-w-[150px] truncate font-mono text-xs">
                {projectFullName}
              </span>
              </div>

              <span>•</span>

              {/* 分支信息 */}
              <div className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="max-w-[70px] truncate text-xs">{projectBranch}</span>
              </div>

              {/* 任务计数 (在非侧边栏模式下) */}
              {!isSidebar && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <ListTodo className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-xs">
                    {completedTasks}/{totalTasks} tasks
                  </span>
                    </div>
                  </>
              )}
            </div>

            {/* 任务计数 (仅在侧边栏模式下，换行显示) */}
            {isSidebar && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListTodo className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                {completedTasks}/{totalTasks} tasks
              </span>
                </div>
            )}
          </div>

          {/* 右侧箭头图标 */}
          <div className="flex flex-col items-center justify-between self-stretch">
            <ArrowRight
                className={cn(
                    "h-4 w-4 flex-shrink-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100",
                )}
            />
            <span className="text-[10px] text-gray-400">{displayDate}</span>
          </div>
        </div>
      </div>
  );
});

// 如果 ESLint 报错，可以加上这个
ThreadItem.displayName = "ThreadItem";