import { HrJobForm } from "@/components/recruitment/hr-job-form";

export default function NewHrJobPage() {
  return <div className="space-y-6"><div><p className="text-sm font-medium text-primary">Recruitment</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">New job opening</h1><p className="mt-2 text-muted-foreground">Save a draft while refining the role, then publish it when ready.</p></div><HrJobForm /></div>;
}
