import { Badge } from "@/components/ui/badge";
import type { DeploymentStatus } from "@/lib/types/database";

export const deploymentStatusLabels: Record<DeploymentStatus, string> = { scheduled: "Scheduled", ongoing: "Ongoing", completed: "Completed", cancelled: "Cancelled" };

const variants: Record<DeploymentStatus, "default" | "secondary" | "outline" | "destructive"> = { scheduled: "secondary", ongoing: "default", completed: "outline", cancelled: "destructive" };

export function DeploymentStatusBadge({ deployment }: { deployment: { status: DeploymentStatus } }) { return <Badge variant={variants[deployment.status]}>{deploymentStatusLabels[deployment.status]}</Badge>; }
