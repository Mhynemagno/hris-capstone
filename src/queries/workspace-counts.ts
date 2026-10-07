import type { NavBadgeKey } from "@/lib/app/role-config";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type WorkspaceCountKey = NavBadgeKey | "unmatchedAttendance";

/** Head-only counts (no rows transferred) for nav badges and the dashboard's attention list. */
export async function getWorkspaceCount(key: WorkspaceCountKey): Promise<number> {
  const client = createBrowserSupabaseClient();
  const head = { count: "exact" as const, head: true };
  const query =
    key === "applicationsAwaitingReview" ? client.from("applications").select("id", head).eq("status", "Submitted")
    : key === "leaveForApproval" ? client.from("leave_requests").select("id", head).eq("status", "pending")
    : key === "profileChangesPending" ? client.from("profile_change_requests").select("id", head).eq("status", "pending")
    : client.from("attendance_unmatched_events").select("id", head).is("resolved_at", null);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
