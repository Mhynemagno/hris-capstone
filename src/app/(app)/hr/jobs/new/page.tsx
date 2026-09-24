import { HrJobForm } from "@/components/recruitment/hr-job-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewHrJobPage() {
  return <div className="space-y-6"><PageHeader description="Save a draft while refining the role, then publish it when ready." eyebrow="Recruitment" title="New job opening" /><HrJobForm /></div>;
}
