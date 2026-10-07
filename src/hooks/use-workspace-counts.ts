"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getWorkspaceCount, type WorkspaceCountKey } from "@/queries/workspace-counts";

export function useWorkspaceCount(key: WorkspaceCountKey, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspace.count(key),
    queryFn: () => getWorkspaceCount(key),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
