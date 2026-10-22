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
    status: query.get("status") ?? undefined,
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

  // The protected route, rather than a browser client, follows all report pages.
  // The fixed ceiling is a circuit breaker against an unexpected malformed count.
  const rows = [...report.data.rows];
  for (let page = 2; rows.length < report.data.totalCount && page <= 100; page += 1) {
    const next = await supabase.rpc(rpc, reportArguments({ ...filters.data, page }));
    if (next.error) return NextResponse.json({ error: "The complete report could not be generated." }, { status: 500 });
    const parsed = reportResponseSchema.safeParse(next.data);
    if (!parsed.success || !parsed.data.rows.length) break;
    rows.push(...parsed.data.rows);
  }
  if (rows.length !== report.data.totalCount) {
    return NextResponse.json({ error: "The report is too large to generate safely. Narrow the filters and try again." }, { status: 422 });
  }

  const pdf = buildReportPdf({ ...report.data, rows, page: 1 });
  return new NextResponse(pdf, {
    headers: {
      "Content-Disposition": `attachment; filename="${report.data.reportKey}-${filters.data.startsOn}-to-${filters.data.endsOn}.pdf"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
