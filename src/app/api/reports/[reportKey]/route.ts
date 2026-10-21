import { NextResponse } from "next/server";

import { getCurrentRole } from "@/lib/auth/current-role";
import { buildReportPdf } from "@/lib/reporting/pdf";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reportFiltersSchema, reportKeySchema, reportResponseSchema } from "@/schemas/reporting";

function reportArguments(filters: ReturnType<typeof reportFiltersSchema.parse>) {
  return {
    target_report_key: filters.reportKey,
    target_starts_on: filters.startsOn,
    target_ends_on: filters.endsOn,
    target_department_id: filters.departmentId ?? null,
    target_status: filters.status ?? null,
    target_page: filters.page,
    target_page_size: filters.pageSize,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ reportKey: string }> }) {
  const { reportKey: filename } = await params;
  if (!filename.endsWith(".pdf")) return new NextResponse("Not found", { status: 404 });
  const reportKey = reportKeySchema.safeParse(filename.slice(0, -4));
  const role = await getCurrentRole();
  if (!reportKey.success || (role !== "hr_personnel" && role !== "management")) return new NextResponse("Not found", { status: 404 });

  const query = new URL(request.url).searchParams;
  const filters = reportFiltersSchema.safeParse({
    reportKey: reportKey.data,
    startsOn: query.get("from") ?? undefined,
    endsOn: query.get("to") ?? undefined,
    departmentId: query.get("department") ?? undefined,
    page: 1,
    pageSize: 100,
  });
  if (!filters.success) return NextResponse.json({ error: "Invalid report filters." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const rpc = role === "hr_personnel" ? "get_hr_report" : "get_management_report";
  const { data, error } = await supabase.rpc(rpc, reportArguments(filters.data));
  if (error) return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  const report = reportResponseSchema.safeParse(data);
  if (!report.success) return NextResponse.json({ error: "The report response was invalid." }, { status: 500 });

  const pdf = buildReportPdf(report.data);
  return new NextResponse(pdf, {
    headers: {
      "Content-Disposition": `attachment; filename="${report.data.reportKey}-${filters.data.startsOn}-to-${filters.data.endsOn}.pdf"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
