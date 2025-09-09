// src/hooks/useGitLabAppProvider.ts (完整版本)

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryState } from "nuqs";
import { GitLabProject } from "@open-swe/shared/gitlab/types"; // 从共享类型导入

// 定义 Branch 类型 (可以放在共享类型文件中)
export interface Branch {
  name: string;
  commit: { sha: string; };
  protected: boolean;
}

const GITLAB_SELECTED_PROJECT_KEY = "selected-gitlab-project";

// --- LocalStorage 辅助函数 ---
const saveProjectToLocalStorage = (project: GitLabProject | null) => {
  if (project) {
    localStorage.setItem(GITLAB_SELECTED_PROJECT_KEY, JSON.stringify({ id: project.id, full_name: project.full_name }));
  } else {
    localStorage.removeItem(GITLAB_SELECTED_PROJECT_KEY);
  }
};

const getProjectFromLocalStorage = (): { id: number; full_name: string } | null => {
  try {
    const stored = localStorage.getItem(GITLAB_SELECTED_PROJECT_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// --- 主 Hook ---
export function useGitLabApp() {
  // --- 状态定义 ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 项目状态
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsHasMore, setProjectsHasMore] = useState(false);
  const [projectsLoadingMore, setProjectsLoadingMore] = useState(false);

  // 分支状态
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesPage, setBranchesPage] = useState(1);
  const [branchesHasMore, setBranchesHasMore] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesLoadingMore, setBranchesLoadingMore] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  // URL 状态
  const [selectedProjectParam, setSelectedProjectParam] = useQueryState("project"); // e.g., "group/repo"
  const [selectedBranchParam, setSelectedBranchParam] = useQueryState("branch");

  const hasAutoSelectedRef = useRef(false);

  // --- 派生状态 ---
  const selectedProject = useMemo(() => {
    if (!selectedProjectParam) return null;
    return projects.find(p => p.full_name === selectedProjectParam) || null;
  }, [selectedProjectParam, projects]);

  const selectedBranch = selectedBranchParam;

  const defaultBranch = selectedProject?.default_branch || null;

  // --- 数据获取函数 ---
  const fetchProjects = useCallback(async (page = 1, append = false) => {
    if (!append) setIsLoading(true);
    if (append) setProjectsLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/gitlab/projects?page=${page}`);
      if (!response.ok) {
        const errData = await response.json();
        // 如果是认证错误，单独处理
        if(response.status === 401) setIsAuthenticated(false);
        throw new Error(errData.error || "Failed to fetch projects.");
      }
      setIsAuthenticated(true);
      const data = await response.json();
      setProjects(prev => append ? [...prev, ...data.repositories] : data.repositories);
      setProjectsPage(data.pagination.page);
      setProjectsHasMore(data.pagination.hasMore);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setProjectsLoadingMore(false);
    }
  }, []);

  const fetchBranches = useCallback(async (page = 1, append = false) => {
    if (!selectedProject) return;
    if (!append) setBranchesLoading(true);
    if (append) setBranchesLoadingMore(true);
    setBranchesError(null);
    try {
      // ✨ 需要一个新的 API 路由来获取分支 ✨
      const response = await fetch(`/api/gitlab/projects/${selectedProject.id}/branches?page=${page}`);
      if (!response.ok) throw new Error("Failed to fetch branches.");
      const data = await response.json();
      setBranches(prev => append ? [...prev, ...data.branches] : data.branches);
      setBranchesPage(data.pagination.page);
      setBranchesHasMore(data.pagination.hasMore);
    } catch (err: any) {
      setBranchesError(err.message);
    } finally {
      setBranchesLoading(false);
      setBranchesLoadingMore(false);
    }
  }, [selectedProject]);

  // --- 用户操作函数 ---
  const setSelectedProject = useCallback((project: GitLabProject | null) => {
    setSelectedProjectParam(project ? project.full_name : null);
    saveProjectToLocalStorage(project);
    // 清空分支选择
    setSelectedBranchParam(null);
    setBranches([]);
  }, [setSelectedProjectParam, setSelectedBranchParam]);

  const setSelectedBranch = (branchName: string | null) => {
    setSelectedBranchParam(branchName);
  };

  const loadMoreProjects = () => {
    if(projectsHasMore && !projectsLoadingMore) fetchProjects(projectsPage + 1, true);
  };

  const loadMoreBranches = () => {
    if(branchesHasMore && !branchesLoadingMore) fetchBranches(branchesPage + 1, true);
  };

  // --- 效果钩子 ---
  // 初始加载项目
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 当选择的项目变化时，获取其分支
  useEffect(() => {
    if (selectedProject) {
      fetchBranches();
    }
  }, [selectedProject, fetchBranches]);

  // 自动选择项目 (从 localStorage 或第一个)
  useEffect(() => {
    if (isLoading || hasAutoSelectedRef.current || projects.length === 0 || selectedProject) {
      return;
    }
    const storedProject = getProjectFromLocalStorage();
    let projectToSelect: GitLabProject | undefined;
    if (storedProject) {
      projectToSelect = projects.find(p => p.id === storedProject.id);
    }
    if (!projectToSelect) {
      projectToSelect = projects[0];
    }
    if (projectToSelect) {
      setSelectedProject(projectToSelect);
      hasAutoSelectedRef.current = true;
    }
  }, [isLoading, projects, selectedProject, setSelectedProject]);

  return {
    isAuthenticated,
    isLoading,
    error,

    projects,
    projectsPage,
    projectsHasMore,
    projectsLoadingMore,
    refreshProjects: fetchProjects, // refresh 就是重新 fetch 第一页
    loadMoreProjects,

    selectedProject,
    setSelectedProject,

    branches,
    branchesPage,
    branchesHasMore,
    branchesLoading,
    branchesLoadingMore,
    branchesError,
    loadMoreBranches,
    fetchBranches,
    refreshBranches: fetchBranches, // 同上

    selectedBranch,
    setSelectedBranch,

    defaultBranch,
  };
}