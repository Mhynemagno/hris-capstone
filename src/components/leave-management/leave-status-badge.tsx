import { Badge } from "@/components/ui/badge";
import type { LeaveRequestStatus } from "@/lib/types/database";
export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) { return <Badge className="capitalize" variant={status === "approved" ? "secondary" : status === "rejected" ? "destructive" : "outline"}>{status}</Badge>; }
