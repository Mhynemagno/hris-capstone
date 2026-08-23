"use client";

import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useReport } from "@/hooks/use-reporting";
import { toReportCsv } from "@/lib/reporting/csv";
import type { ReportFilters } from "@/schemas/reporting";

export function ReportDetail({ role, reportKey }: { role: "hr_personnel" | "management"; reportKey: ReportFilters["reportKey"] }) {
  const [filters, setFilters] = useState<Partial<ReportFilters>>({ reportKey });
  const query = useReport({ reportKey, ...filters }, role);
  const download = () => {
    if (!query.data) return;
    const href = URL.createObjectURL(new Blob([toReportCsv(query.data)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href; link.download = `${query.data.reportKey}-${query.data.generatedAt.slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(href);
  };
  const updateFilter = (next: Partial<ReportFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));
  return <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold tracking-wide text-primary uppercase">Reports</p><h1 className="text-3xl font-semibold tracking-tight">{reportKey.replaceAll("-", " ")}</h1></div><div className="flex gap-2 print:hidden"><button className="rounded-md border px-3 py-2 text-sm" disabled={!query.data} onClick={download} type="button">Download CSV</button><button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => window.print()} type="button">Print report</button></div></div><form className="flex flex-wrap gap-3 rounded-xl border p-4 print:hidden" onSubmit={(event) => event.preventDefault()}><label className="grid gap-1 text-sm">Start date<input className="rounded border px-2 py-1" onChange={(event) => updateFilter({ startsOn: event.target.value })} type="date" /></label><label className="grid gap-1 text-sm">End date<input className="rounded border px-2 py-1" onChange={(event) => updateFilter({ endsOn: event.target.value })} type="date" /></label><label className="grid gap-1 text-sm">Department ID<input className="rounded border px-2 py-1" min="1" onChange={(event) => updateFilter({ departmentId: event.target.value ? Number(event.target.value) : undefined })} type="number" /></label><label className="grid gap-1 text-sm">Status<input className="rounded border px-2 py-1" onChange={(event) => updateFilter({ status: event.target.value || undefined })} type="text" /></label></form>{query.isLoading ? <LoadingState label="Loading report…" /> : query.error ? <ErrorState message={query.error.message} /> : query.data ? <div className="overflow-x-auto rounded-xl border"><p className="p-4 text-sm text-muted-foreground">Applied filters: {filters.startsOn ?? "default start"} to {filters.endsOn ?? "default end"}; {filters.departmentId ? `department ${filters.departmentId}` : "all departments"}; {filters.status ?? "all statuses"}. {query.data.totalCount} matching record{query.data.totalCount === 1 ? "" : "s"}.</p><table className="w-full min-w-[640px] text-sm"><thead className="bg-muted"><tr>{query.data.columns.map((column) => <th className="p-3 text-left" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{query.data.rows.length ? query.data.rows.map((row, index) => <tr className="border-t" key={index}>{query.data.columns.map((column) => <td className="p-3" key={column.key}>{String(row[column.key] ?? "")}</td>)}</tr>) : <tr><td className="p-3 text-muted-foreground" colSpan={query.data.columns.length}>No authorized records match the selected filters.</td></tr>}</tbody></table><div className="flex items-center justify-between border-t p-3 print:hidden"><button className="rounded border px-3 py-1 text-sm" disabled={query.data.page === 1} onClick={() => setFilters((current) => ({ ...current, page: query.data!.page - 1 }))} type="button">Previous</button><span className="text-sm">Page {query.data.page}</span><button className="rounded border px-3 py-1 text-sm" disabled={query.data.page * query.data.pageSize >= query.data.totalCount} onClick={() => setFilters((current) => ({ ...current, page: query.data!.page + 1 }))} type="button">Next</button></div></div> : null}</section>;
}
