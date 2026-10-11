import Link from "next/link";
import { Suspense } from "react";

import { StaffReports } from "@/components/reporting/staff-reports";
import { getCurrentRole } from "@/lib/auth/current-role";
import { REPORT_KEYS } from "@/schemas/reporting";

export default async function ReportsPage() {
  // HR uses the Capstone UI reports screen; management keeps the plain list until its redesign.
  if ((await getCurrentRole()) === "hr_personnel") return <Suspense><StaffReports /></Suspense>;
  return <section className="space-y-6"><div><h1 className="text-3xl font-bold tracking-tight">Reports</h1><p className="mt-2 text-muted-foreground">Filter, export, or print role-appropriate personnel reports.</p></div><div className="grid gap-4 sm:grid-cols-2">{REPORT_KEYS.map((reportKey) => <Link className="rounded-xl border p-4 font-medium hover:bg-muted" href={`/reports/${reportKey}`} key={reportKey}>{reportKey.replaceAll("-", " ")}</Link>)}</div></section>;
}
