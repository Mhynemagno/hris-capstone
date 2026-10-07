import { Badge } from "@/components/ui/badge";
import { stageBadgeVariant } from "@/lib/recruitment/application-stages";
import type { ApplicationStatus } from "@/schemas/recruitment";

export function ApplicationStageBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={stageBadgeVariant(status)}>{status}</Badge>;
}
