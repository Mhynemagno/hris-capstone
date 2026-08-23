import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus } from "@/lib/types/database";

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) { return <Badge variant={status === "absent" ? "destructive" : status === "late" || status === "incomplete" ? "secondary" : "default"}>{status}</Badge>; }
