// src/hooks/useThreadsSWR.ts (GitLab 最终正确版)

import useSWR from "swr";
import { Thread } from "@langchain/langgraph-sdk";
import { createClient } from "@/providers/client"; // 假设这个 client 是平台无关的
import { THREAD_SWR_CONFIG } from "@/lib/swr-config";
import { ManagerGraphState } from "@open-swe/shared/open-swe/manager/types";
import { PlannerGraphState } from "@open-swe/shared/open-swe/planner/types";
import { ReviewerGraphState } from "@open-swe/shared/open-swe/reviewer/types";
import { GraphState } from "@open-swe/shared/open-swe/types";

import { useMemo, useState } from "react";


type ThreadSortBy = "thread_id" | "status" | "created_at" | "updated_at";
type SortOrder = "asc" | "desc";
export type AnyGraphState =
    | ManagerGraphState
    | PlannerGraphState
    | ReviewerGraphState
    | GraphState;

interface UseThreadsSWROptions {
  assistantId?: string;
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  // ✨ 1. 移除了 currentInstallation 和 disableOrgFiltering
  pagination?: {
    limit?: number;
    offset?: number;
    sortBy?: ThreadSortBy;
    sortOrder?: SortOrder;
  };
}

export function useThreadsSWR<
    TGraphState extends AnyGraphState = AnyGraphState,
>(options: UseThreadsSWROptions = {}) {
  const {
    assistantId,
    refreshInterval = THREAD_SWR_CONFIG.refreshInterval,
    revalidateOnFocus = THREAD_SWR_CONFIG.revalidateOnFocus,
    revalidateOnReconnect = THREAD_SWR_CONFIG.revalidateOnReconnect,
    pagination,
  } = options;

  // ✨ 2. 移除了 hasMoreState，因为 search 方法的返回值本身就可以判断

  // 分页和排序的默认值逻辑保持不变
  const paginationWithDefaults = {
    limit: 25,
    offset: 0,
    sortBy: "updated_at" as ThreadSortBy,
    sortOrder: "desc" as SortOrder,
    ...pagination,
  };

  const apiUrl: string = process.env.NEXT_PUBLIC_API_URL ?? "";

  // SWR key 的构建逻辑保持不变，它已经是通用的了
  const swrKey = useMemo(() => {
    const baseKey = assistantId ? ["threads", assistantId] : ["threads", "all"];
    if (pagination) {
      return [
        ...baseKey,
        paginationWithDefaults.limit,
        paginationWithDefaults.offset,
        paginationWithDefaults.sortBy,
        paginationWithDefaults.sortOrder,
      ];
    }
    return baseKey;
  }, [assistantId, paginationWithDefaults]);

  // Fetcher 函数逻辑基本不变
  const fetcher = async (): Promise<Thread<TGraphState>[]> => {
    if (!apiUrl) throw new Error("API URL is not configured");

    const client = createClient(apiUrl);
    const searchArgs = assistantId
        ? { metadata: { graph_id: assistantId }, ...paginationWithDefaults }
        : paginationWithDefaults;

    // ✨ client.threads.search 返回的就是过滤后的线程，不需要前端再处理
    return await client.threads.search<TGraphState>(searchArgs);
  };

  const { data, error, isLoading, mutate, isValidating } = useSWR(
      swrKey,
      fetcher,
      {
        // SWR 配置保持不变
        ...THREAD_SWR_CONFIG,
        refreshInterval,
        revalidateOnFocus,
        revalidateOnReconnect,
      },
  );

  // ✨ 3. threads 的计算逻辑大大简化 ✨
  // 我们不再需要根据 currentInstallation 进行客户端过滤
  const threads = data ?? [];

  // ✨ 4. hasMore 的计算逻辑也更直接 ✨
  // 如果返回的线程数小于请求的 limit，说明没有更多了
  const hasMore = threads.length === paginationWithDefaults.limit;

  return {
    threads,
    error,
    isLoading,
    isValidating,
    mutate,
    hasMore,
  };
}