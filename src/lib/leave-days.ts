import type { LeaveBalance } from "@/lib/types/database";

/** "1 day" / "3 days". */
export const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/** Inclusive calendar days between two ISO dates, the way submit_leave_request counts them. */
export function leaveDays(startsOn: string, endsOn: string) {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Days still available of a limited leave type, or null when the type has no yearly limit. */
export function remainingLeaveDays(balance: Pick<LeaveBalance, "days_per_year" | "used_days"> | undefined) {
  if (!balance || balance.days_per_year === null) return null;
  return Math.max(balance.days_per_year - balance.used_days, 0);
}

/** Days of a request beyond the remaining credits (0 when it fits or the type has no limit); these are deducted. */
export function excessLeaveDays(requestedDays: number, remaining: number | null) {
  return remaining === null ? 0 : Math.max(requestedDays - remaining, 0);
}
