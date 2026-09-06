import { Badge } from "@/components/ui/badge";
import type { DeploymentStatus } from "@/lib/types/database";

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) { return <Badge variant={status === "active" ? "default" : "destructive"}>{status}</Badge>; }
