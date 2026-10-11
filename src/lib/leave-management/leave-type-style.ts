import { Baby, CalendarCheck, Star, Stethoscope, Users, type LucideIcon } from "lucide-react";

import type { LeaveRequestWithEmployee } from "@/lib/types/database";

export type LeaveTone = "blue" | "purple" | "emerald" | "rose" | "amber" | "slate";

const STYLES: { match: string; Icon: LucideIcon; tone: LeaveTone; footnote: string }[] = [
  { match: "mandatory", Icon: CalendarCheck, tone: "blue", footnote: "Standard yearly entitlement." },
  { match: "maternity", Icon: Baby, tone: "purple", footnote: "Full pay for female personnel." },
  { match: "paternity", Icon: Users, tone: "emerald", footnote: "Married male personnel." },
  { match: "sick", Icon: Stethoscope, tone: "rose", footnote: "Requires medical certificate." },
  { match: "special privilege", Icon: Star, tone: "amber", footnote: "Non-cumulative entitlement." },
];

/** The leave.html entitlement card icon, colour and footnote for a leave type, by name. */
export function leaveTypeStyle(name: string): { Icon: LucideIcon; tone: LeaveTone; footnote: string } {
  const lower = name.toLowerCase();
  const style = STYLES.find((entry) => lower.includes(entry.match));
  return style ? { Icon: style.Icon, tone: style.tone, footnote: style.footnote } : { Icon: CalendarCheck, tone: "slate", footnote: "" };
}

export const LEAVE_TONE_CLASSES: Record<LeaveTone, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-700",
  purple: "bg-purple-50 border-purple-200 text-purple-700",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
  rose: "bg-rose-50 border-rose-200 text-rose-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  slate: "bg-slate-50 border-slate-200 text-slate-700",
};

/** Full name of the employee who filed a leave request, e.g. "Juan Dela Cruz". */
export function leaveEmployeeName(request: Pick<LeaveRequestWithEmployee, "employees">) {
  const employee = request.employees;
  if (!employee) return "Unknown employee";
  return [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
}

/** "October 5, 2026 – October 6, 2026", as in the leave.html queue and review box. */
export function leaveDateRange(startsOn: string, endsOn: string, format: (value: string) => string | null) {
  return `${format(startsOn)} – ${format(endsOn)}`;
}
