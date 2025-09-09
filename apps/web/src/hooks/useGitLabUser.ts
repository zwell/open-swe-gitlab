import { useState, useEffect } from "react";
import type { GitLabUser } from "@open-swe/shared/gitlab/verify-user"; // 确保路径正确

export function useGitLabUser() {
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      setIsLoading(true);
      setError(null);
      try {
        // ✨ 创建一个新的 API 路由来获取当前登录的用户信息
        const response = await fetch("/api/auth/gitlab/user");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch user.");
        }
        const userData = await response.json();
        setUser(userData.user);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  return { user, isLoading, error };
}