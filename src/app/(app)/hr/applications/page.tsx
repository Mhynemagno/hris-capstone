import { HrApplicationList } from "@/components/recruitment/hr-application-list";
import { PageHeader } from "@/components/ui/page-header";

export default function HrApplicationsPage() {
  return <div className="space-y-6"><PageHeader description="Review applications, record decisions, and complete hiring handoffs." eyebrow="Recruitment" title="Application queue" /><HrApplicationList /></div>;
}
