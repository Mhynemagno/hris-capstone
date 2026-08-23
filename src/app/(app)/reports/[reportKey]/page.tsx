import { notFound } from "next/navigation";

import { ReportDetail } from "@/components/reporting/report-detail";
import { getCurrentRole } from "@/lib/auth/current-role";
import { reportKeySchema } from "@/schemas/reporting";

export default async function ReportDetailPage({ params }: { params: Promise<{ reportKey: string }> }) {
  const { reportKey } = await params;
  const parsed = reportKeySchema.safeParse(reportKey);
  if (!parsed.success) notFound();
  const role = await getCurrentRole();
  if (role !== "hr_personnel" && role !== "management") notFound();
  return <ReportDetail role={role} reportKey={parsed.data} />;
}
