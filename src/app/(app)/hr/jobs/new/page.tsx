import { HrJobForm } from "@/components/recruitment/hr-job-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewHrJobPage() {
  return <div className="space-y-6"><PageHeader title="Create new Recruitment" /><HrJobForm /></div>;
}
