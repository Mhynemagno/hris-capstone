import Link from "next/link";

import { HrApplicationList } from "@/components/recruitment/hr-application-list";
import { HrRegisteredApplicantList } from "@/components/recruitment/hr-registered-applicant-list";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const tabs = [
  { view: "applications", label: "Applications", href: "/hr/applications" },
  { view: "applicants", label: "Applicants", href: "/hr/applications?view=applicants" },
] as const;

export default async function HrApplicationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const active = view === "applicants" ? "applicants" : "applications";
  return <div className="space-y-6">
    <PageHeader description={active === "applicants" ? "Every registered applicant account, including those who have not applied yet." : "Review applications, record decisions, and complete hiring handoffs."} title={active === "applicants" ? "Applicants" : "Application queue"} />
    <nav aria-label="Recruitment views" className="flex gap-1 border-b">
      {tabs.map((tab) => <Link aria-current={tab.view === active ? "page" : undefined} className={cn("-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors", tab.view === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")} href={tab.href} key={tab.view}>{tab.label}</Link>)}
    </nav>
    {active === "applicants" ? <HrRegisteredApplicantList /> : <HrApplicationList />}
  </div>;
}
