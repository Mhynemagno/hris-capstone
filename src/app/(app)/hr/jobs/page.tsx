import Link from "next/link";

import { HrJobList } from "@/components/recruitment/hr-job-list";
import { PageHeader } from "@/components/ui/page-header";

export default function HrJobsPage() {
  return <div className="space-y-8"><PageHeader action={<Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/hr/jobs/new">Create new Recruitment</Link>} title="Recruitment" /><HrJobList /></div>;
}
