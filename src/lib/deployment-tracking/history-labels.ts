import { deploymentStatusLabels } from "@/components/deployment-tracking/deployment-status-badge";
import type { DeploymentHistory, DeploymentStatus } from "@/lib/types/database";

function statusLabel(metadata: Record<string, unknown>, side: "before" | "after") {
  const snapshot = metadata[side];
  const status = snapshot && typeof snapshot === "object" ? (snapshot as { status?: unknown }).status : undefined;
  return typeof status === "string" && status in deploymentStatusLabels ? deploymentStatusLabels[status as DeploymentStatus] : null;
}

/** "Deployment created by …", "Status changed from Scheduled to Ongoing by …", or "Details updated by …". */
export function describeDeploymentEvent(event: Pick<DeploymentHistory, "event_type" | "metadata">, actorName: string | null) {
  const by = actorName ? ` by ${actorName}` : "";
  if (event.event_type === "created") return `Deployment created${by}`;
  if (event.event_type === "status_changed") {
    const before = statusLabel(event.metadata, "before");
    const after = statusLabel(event.metadata, "after");
    return before && after ? `Status changed from ${before} to ${after}${by}` : `Status changed${by}`;
  }
  return `Details updated${by}`;
}
