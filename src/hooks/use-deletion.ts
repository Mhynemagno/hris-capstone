"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteRecord, getDeletionImpact, type DeletableEntityType } from "@/queries/deletion";

/** Query keys to refresh after each kind of deletion so lists update immediately. */
const invalidationKeys: Record<DeletableEntityType, readonly (readonly string[])[]> = {
  leave_type: [["leave-management"], ["administration", "audit-logs"]],
  promotion_criterion: [["promotion-eligibility"], ["administration", "audit-logs"]],
  job_opening: [["recruitment"], ["reporting"], ["administration", "audit-logs"]],
  managed_user: [["administration", "users"], ["administration", "roles"], ["administration", "audit-logs"], ["personnel-records"]],
  notification: [["notifications"]],
};

export function useDeletionImpact(entityType: DeletableEntityType, entityId: string | number | null) {
  return useQuery({
    queryKey: ["deletion-impact", entityType, entityId === null ? null : String(entityId)],
    queryFn: () => getDeletionImpact(entityType, entityId as string | number),
    enabled: entityId !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useDeleteRecord(entityType: DeletableEntityType) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string | number) => deleteRecord(entityType, entityId),
    onSuccess: () => {
      for (const key of invalidationKeys[entityType]) void client.invalidateQueries({ queryKey: [...key] });
    },
  });
}
