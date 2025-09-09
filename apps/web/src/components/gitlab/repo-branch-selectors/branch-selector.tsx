// src/components/gitlab/BranchSelector_gitlab.tsx (新文件)

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
import { Check, ChevronsUpDown, GitBranch, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
// ✨ 1. 导入我们的 GitLab Provider Hook
import { useGitLabAppProvider } from "@/providers/GitLabApp";
import { TargetRepository } from "@open-swe/shared/open-swe/types"; // 这个类型是通用的，保持
import { Branch } from "@/hooks/useGitLabApp";
import { toast } from "sonner";
import { defaultFilter } from "cmdk";

// (接口定义保持不变)
interface BranchSelectorProps {
  disabled?: boolean;
  placeholder?: string;
  buttonClassName?: string;
  chatStarted?: boolean;
  streamTargetRepository?: TargetRepository;
}

// (辅助函数 findDefaultBranch 保持不变)
const findDefaultBranch = (branches: Branch[], defaultBranch: string | null) => {
  const actualDefaultBranch = defaultBranch
      ? branches.find((branch) => branch.name === defaultBranch)
      : null;

  return actualDefaultBranch
      ? actualDefaultBranch.name
      : branches.length > 0
          ? branches[0].name
          : null;
};

export function BranchSelector({
                                        disabled = false,
                                        placeholder = "Select a branch...",
                                        buttonClassName,
                                        chatStarted = false,
                                        streamTargetRepository,
                                      }: BranchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // const [isSearching, setIsSearching] = useState(false); // searchForBranch 逻辑需要调整

  // ✨ 3. 从 GitLab Provider Hook 获取所有需要的数据和函数
  const {
    branches,
    branchesLoading,
    branchesError,
    selectedBranch,
    setSelectedBranch,
    selectedProject, // 替换 selectedRepository
    branchesHasMore,
    branchesLoadingMore,
    loadMoreBranches,
    // searchForBranch, // GitLab 版本的 search 需要一个新的后端 API，暂时简化
    defaultBranch,
  } = useGitLabAppProvider();

  // 自动选择默认分支的逻辑保持不变，只需替换变量名
  useEffect(() => {
    if (
        selectedProject && // 使用 selectedProject
        !branchesLoading &&
        !branchesError &&
        branches.length > 0 &&
        !selectedBranch // 只在没有选择分支时自动选择
    ) {
      setSelectedBranch(findDefaultBranch(branches, defaultBranch));
    }
  }, [
    selectedProject,
    branches,
    branchesLoading,
    branchesError,
    selectedBranch,
    setSelectedBranch,
    defaultBranch,
  ]);

  const handleSelect = (branchName: string) => {
    setSelectedBranch(branchName);
    setOpen(false);
  };

  // ✨ GitLab 版本的 searchForBranch 需要一个后端 API。
  // 暂时简化或移除这个功能，因为它需要额外的后端工作。
  // 如果需要，可以创建一个 /api/gitlab/projects/:id/branches/search?q=... 的端点。
  /*
  const handleSearchForBranch = async () => { ... };
  */

  // --- 渲染逻辑 ---

  // 如果没有选择项目，显示禁用状态
  if (!selectedProject) {

    return (
        <Button
            variant="outline"
            disabled
            className={cn(buttonClassName)}
            size="sm"
        >
          <GitBranch />
          <span>Select a branch</span>
        </Button>
    );
  }

  // (加载中、错误、无分支的 UI 渲染逻辑保持不变，只替换变量名)
  if (branchesLoading && branches.length === 0) {
    return <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
    >
      <GitBranch />
      <span>Loading branches...</span>
    </Button>
  }
  if (branchesError) {
    return <Button
        variant="outline"
        disabled
        className={cn(buttonClassName)}
        size="sm"
    >
      <GitBranch />
      <span>Error loading branches</span>
    </Button>
  }

  // 聊天开始后的只读模式，保持不变
  if (chatStarted) {
    const displayValue = streamTargetRepository?.branch || selectedBranch;
    return (
        <Button
            variant="outline"
            className={cn(buttonClassName)}
            size="sm"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <GitBranch />
            <span className="truncate text-left">
            {displayValue || placeholder}
          </span>
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
              size="sm"
              disabled={disabled}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <GitBranch />
              <span className="truncate text-left">
              {selectedBranch || placeholder}
            </span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0">
          <Command filter={defaultFilter}> {/* 使用内置过滤器 */}
            <CommandInput
                placeholder="Search branches..."
                value={searchQuery}
                onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No branches found.</CommandEmpty>
              <CommandGroup>
                {branches
                    .slice()
                    .sort(/* ... 排序逻辑保持不变 ... */)
                    .map((branch) => {
                      const isSelected = selectedBranch === branch.name;
                      const isDefault = branch.name === defaultBranch;
                      return (
                          <CommandItem
                              key={branch.name}
                              value={branch.name}
                              onSelect={() => handleSelect(branch.name)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-3 w-3" />
                              <span className="font-medium">{branch.name}</span>
                              {isDefault && <span className="rounded bg-blue-100 ...">default</span>}
                              {branch.protected && <div title="Protected branch"><Shield className="h-3 w-3 ..." /></div>}
                            </div>
                          </CommandItem>
                      );
                    })}
              </CommandGroup>
              {branchesHasMore && (
                  <CommandGroup>
                    <CommandItem onSelect={loadMoreBranches} disabled={branchesLoadingMore} className="justify-center">
                      {branchesLoadingMore ? "Loading more..." : "Load more branches"}
                    </CommandItem>
                  </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
  );
}