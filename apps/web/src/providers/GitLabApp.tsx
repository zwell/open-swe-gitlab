// src/providers/GitLabAppProvider.tsx (新文件)

"use client";

// ✨ 1. 导入我们新的 GitLab Hook
import { useGitLabApp } from "@/hooks/useGitLabApp";
import { createContext, useContext, ReactNode } from "react";

// ✨ 2. 定义新的 Context 类型，它来自于新 Hook 的返回值
type GitLabContextType = ReturnType<typeof useGitLabApp>;

// ✨ 3. 创建新的 GitLab Context
const GitLabContext = createContext<GitLabContextType | undefined>(
    undefined,
);

// ✨ 4. 创建新的 GitLab Provider 组件
export function GitLabAppProvider({ children }: { children: ReactNode }) {
  // 调用我们的 GitLab Hook 来获取值
  const value = useGitLabApp();

  // 将值提供给所有子组件
  return (
      <GitLabContext.Provider value={value}>
        {children}
      </GitLabContext.Provider>
  );
}

// ✨ 5. 创建一个新的、用于消费 Context 的 Hook
export function useGitLabAppProvider() {
  const context = useContext(GitLabContext);
  if (context === undefined) {
    // 更新错误信息
    throw new Error(
        "useGitLabAppProvider must be used within a GitLabAppProvider",
    );
  }
  return context;
}