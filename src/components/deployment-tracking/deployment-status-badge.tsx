import { Badge } from "@/components/ui/badge";
import type { DeploymentStatus } from "@/lib/types/database";

export type EffectiveDeploymentStatus = DeploymentStatus | "upcoming";

const labels: Record<EffectiveDeploymentStatus, string> = { active: "Active", upcoming: "Upcoming", rejected: "Rejected" };

/** Today's calendar date (`YYYY-MM-DD`) in the Philippines, where deployments take effect. */
export function manilaToday(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }

/** An active deployment whose start date has not arrived yet is shown as upcoming; it becomes active on its start date without any stored change. */
export function effectiveDeploymentStatus({ status, starts_on }: { status: DeploymentStatus; starts_on: string }, today = manilaToday()): EffectiveDeploymentStatus { return status === "active" && starts_on.slice(0, 10) > today ? "upcoming" : status; }

export function DeploymentStatusBadge({ deployment, today }: { deployment: { status: DeploymentStatus; starts_on: string }; today?: string }) { const status = effectiveDeploymentStatus(deployment, today); return <Badge variant={status === "active" ? "default" : status === "upcoming" ? "secondary" : "destructive"}>{labels[status]}</Badge>; }
