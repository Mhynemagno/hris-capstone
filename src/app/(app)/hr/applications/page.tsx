import { HrApplicationList } from "@/components/recruitment/hr-application-list";

export default function HrApplicationsPage() {
  return <main className="space-y-6"><div><p className="text-sm font-medium text-primary">Recruitment</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Application queue</h1><p className="mt-2 text-muted-foreground">Review applications, record decisions, and complete hiring handoffs.</p></div><HrApplicationList /></main>;
}
