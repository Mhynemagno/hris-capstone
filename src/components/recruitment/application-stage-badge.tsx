import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/schemas/recruitment";

export function ApplicationStageBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant="neutral">{status}</Badge>;
}
