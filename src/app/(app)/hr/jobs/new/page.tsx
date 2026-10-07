import { HrJobForm } from "@/components/recruitment/hr-job-form";
import { PageHeader } from "@/components/ui/page-header";
import { PageContainer } from "@/components/workspace-shell/page-container";

export default function NewHrJobPage() {
  return <PageContainer width="wide"><PageHeader title="New job posting" /><HrJobForm /></PageContainer>;
}
