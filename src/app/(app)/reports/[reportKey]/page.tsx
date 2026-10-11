import { notFound } from "next/navigation";

import { ReportDetail } from "@/components/reporting/report-detail";
import { getCurrentRole } from "@/lib/auth/current-role";
import { reportKeySchema } from "@/schemas/reporting";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportDetailPage({ params, searchParams }: {
  params: Promise<{ reportKey: string }>;
  searchParams: Promise<{ from?: string; to?: string; department?: string; print?: string; export?: string }>;
}) {
  const { reportKey } = await params;
  const parsed = reportKeySchema.safeParse(reportKey);
  if (!parsed.success) notFound();
  const role = await getCurrentRole();
  if (role !== "hr_personnel" && role !== "management") notFound();
  const query = await searchParams;
  // The Generate Report modal (Capstone UI reports.html) sends its filters and export format here.
  const initialFilters = {
    startsOn: query.from && ISO_DATE.test(query.from) ? query.from : "",
    endsOn: query.to && ISO_DATE.test(query.to) ? query.to : "",
    departmentId: query.department && /^\d+$/.test(query.department) ? query.department : "",
  };
  const autoAction = query.export === "csv" ? "csv" : query.print === "1" ? "print" : null;
  return <ReportDetail autoAction={autoAction} initialFilters={initialFilters} role={role} reportKey={parsed.data} />;
}
