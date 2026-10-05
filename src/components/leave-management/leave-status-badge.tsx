import { Badge } from "@/components/ui/badge";
import type { LeaveRequestStatus } from "@/lib/types/database";

/** How each leave status reads on screen; a request awaiting HR is "For Approval" (client request). */
export const leaveStatusLabels: Record<LeaveRequestStatus, string> = {
  pending: "For Approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) { return <Badge variant={status === "approved" ? "secondary" : status === "rejected" ? "destructive" : "outline"}>{leaveStatusLabels[status]}</Badge>; }
