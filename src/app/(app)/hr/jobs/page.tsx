import Link from "next/link";

import { HrJobList } from "@/components/recruitment/hr-job-list";

export default function HrJobsPage() {
  return <main className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">Recruitment</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Job openings</h1><p className="mt-2 text-muted-foreground">Create, publish, and close organization job openings.</p></div><Link className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="/hr/jobs/new">New job opening</Link></div><HrJobList /></main>;
}
