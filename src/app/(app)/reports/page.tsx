import Link from "next/link";

import { REPORT_KEYS } from "@/schemas/reporting";

export default function ReportsPage() {
  return <section className="space-y-6"><div><p className="text-sm font-semibold tracking-wide text-primary uppercase">Analytics</p><h1 className="text-3xl font-semibold tracking-tight">Reports</h1><p className="mt-2 text-muted-foreground">Filter, export, or print role-appropriate workforce reports.</p></div><div className="grid gap-4 sm:grid-cols-2">{REPORT_KEYS.map((reportKey) => <Link className="rounded-xl border p-4 font-medium hover:bg-muted" href={`/reports/${reportKey}`} key={reportKey}>{reportKey.replaceAll("-", " ")}</Link>)}</div></section>;
}
