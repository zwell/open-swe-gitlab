"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { GitLabSVG } from "@/components/icons/gitlab";
// ✨ 1. 导入我们的 GitLab Provider Hook 和共享类型
import { useGitLabAppProvider } from "@/providers/GitLabApp";
import { GitLabProject } from "@open-swe/shared/gitlab/types";
import { TargetRepository } from "@open-swe/shared/open-swe/types";

// (接口定义保持不变)
interface ProjectSelectorProps {
  disabled?: boolean;
  placeholder?: string;
  buttonClassName?: string;
  chatStarted?: boolean;
  streamTargetRepository?: TargetRepository;
}

export function RepositorySelector({
                                         disabled = false,
                                         placeholder = "Select a project...",
                                         buttonClassName,
                                         chatStarted = false,
                                         streamTargetRepository,
                                       }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);

  // ✨ 2. 从 GitLab Provider Hook 获取所有需要的数据和函数
  const {
    projects, // 替换 repositories
    selectedProject, // 替换 selectedRepository
    setSelectedProject, // 替换 setSelectedRepository
    isLoading,
    error,
    projectsHasMore, // 替换 repositoriesHasMore
    projectsLoadingMore, // 替换 repositoriesLoadingMore
    loadMoreProjects, // 替换 loadMoreRepositories
  } = useGitLabAppProvider();

  const handleSelect = (project: GitLabProject) => {
    // ✨ setSelectedProject 现在直接接收 project 对象
    setSelectedProject(project);
    setOpen(false);
  };

  // ✨ 3. selectedValue 现在基于 selectedProject.full_name
  const selectedValue = selectedProject ? selectedProject.full_name : undefined;

  // 当聊天开始后，用于显示的只读值
  const displayValue =
      chatStarted && streamTargetRepository
          ? `${streamTargetRepository.owner}/${streamTargetRepository.repo}`
          : selectedValue;

  // --- 渲染逻辑 ---

  // 加载中状态
  if (isLoading && projects.length === 0) {
    return (
        <Button variant="outline" disabled className={cn(buttonClassName)} size="sm">
          <div className="flex items-center gap-2">
            <GitLabSVG width="16" height="16" />
            <span>Loading projects...</span>
          </div>
        </Button>
    );
  }

  // 错误状态
  if (error) {
    return (
        <Button variant="outline" disabled className={cn(buttonClassName)} size="sm">
          <div className="flex items-center gap-2">
            <GitLabSVG width="16" height="16" />
            <span>Error: Check console</span>
          </div>
        </Button>
    );
  }

  // ✨ 4. 移除了 isInstalled === false 的检查

  // 无可用项目
  if (projects.length === 0) {
    return (
        <Button variant="outline" disabled className={cn(buttonClassName)} size="sm">
          <div className="flex items-center gap-2">
            <GitLabSVG width="16" height="16" />
            <span>No projects available</span>
          </div>
        </Button>
    );
  }

  // 聊天开始后的只读模式
  if (chatStarted) {
    return (
        <Button variant="outline" className={cn(buttonClassName)} size="sm">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <GitLabSVG />
            <span className="truncate text-left">{displayValue || placeholder}</span>
          </div>
        </Button>
    );
  }

  // 主要的可交互下拉菜单
  return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(buttonClassName)}
                disabled={disabled}
                size="sm"
            >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <GitLabSVG />
                    <span className="truncate text-left">
              {selectedValue || placeholder}
            </span>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0">
          <Command>
            <CommandInput placeholder="Search projects..." />
            <CommandList>
              <CommandEmpty>No projects found.</CommandEmpty>
              <CommandGroup>
                {projects.map((project) => {
                  const isSelected = selectedValue === project.full_name;
                  return (
                      <CommandItem
                          key={project.id}
                          value={project.full_name} // 使用 full_name 进行搜索
                          onSelect={() => handleSelect(project)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="font-medium">{project.full_name}</span>
                        </div>
                      </CommandItem>
                  );
                })}
              </CommandGroup>
              {projectsHasMore && (
                  <CommandGroup>
                    <CommandItem
                        onSelect={loadMoreProjects} // 调用 GitLab Provider 的函数
                        disabled={projectsLoadingMore}
                        className="justify-center"
                    >
                      {projectsLoadingMore ? "Loading more..." : "Load more projects"}
                    </CommandItem>
                  </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
  );
}