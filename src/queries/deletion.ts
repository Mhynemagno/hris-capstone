import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deleteManagedUser } from "@/queries/administration";

export const DELETABLE_ENTITY_TYPES = [
  "leave_type",
  "promotion_criterion",
  "job_opening",
  "managed_user",
  "notification",
  "employee",
] as const;

export type DeletableEntityType = (typeof DELETABLE_ENTITY_TYPES)[number];

export type DeletionCount = { label: string; count: number };

/** Server-computed preview of what a delete would do (see private.deletion_impact). */
export type DeletionImpact = {
  entityType: DeletableEntityType;
  entityId: string;
  label: string;
  canDelete: boolean;
  blockers: DeletionCount[];
  reasons: string[];
  removes: DeletionCount[];
  alternative: string | null;
};

const deleteRpc: Record<Exclude<DeletableEntityType, "managed_user">, { name: string; arg: string; numeric: boolean }> = {
  leave_type: { name: "delete_leave_type", arg: "target_leave_type_id", numeric: false },
  promotion_criterion: { name: "delete_promotion_criterion", arg: "target_criterion_id", numeric: false },
  job_opening: { name: "delete_draft_job_opening", arg: "target_job_id", numeric: true },
  notification: { name: "delete_notification", arg: "target_notification_id", numeric: false },
  employee: { name: "delete_employee", arg: "target_employee_id", numeric: false },
};

export async function getDeletionImpact(entityType: DeletableEntityType, entityId: string | number): Promise<DeletionImpact> {
  const { data, error } = await createBrowserSupabaseClient().rpc("get_deletion_impact", {
    entity_type: entityType,
    entity_id: String(entityId),
  });
  if (error) throw new Error(error.message);
  const impact = data as DeletionImpact;
  return {
    ...impact,
    blockers: impact.blockers ?? [],
    reasons: impact.reasons ?? [],
    removes: impact.removes ?? [],
    alternative: impact.alternative ?? null,
  };
}

/** Permanently deletes a record. Authorisation and dependency checks run in the database. */
export async function deleteRecord(entityType: DeletableEntityType, entityId: string | number) {
  if (entityType === "managed_user") {
    await deleteManagedUser({ userId: String(entityId) });
    return;
  }
  const rpc = deleteRpc[entityType];
  const value = rpc.numeric ? Number(entityId) : String(entityId);
  const { error } = await createBrowserSupabaseClient().rpc(rpc.name, { [rpc.arg]: value });
  if (error) throw new Error(error.message);
}
