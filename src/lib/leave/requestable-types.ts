import type { LeaveType } from "@/lib/types/database";

/** Active leave types an employee may request: gender-specific types (Maternity, Paternity) only for a matching gender. */
export function requestableLeaveTypes<T extends Pick<LeaveType, "is_active" | "eligible_gender">>(types: readonly T[], gender: "female" | "male" | null | undefined) {
  return types.filter((type) => type.is_active && (type.eligible_gender === null || type.eligible_gender === gender));
}
