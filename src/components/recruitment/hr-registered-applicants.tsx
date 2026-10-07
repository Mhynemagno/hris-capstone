"use client";

import Link from "next/link";
import { useState } from "react";

import { ApplicationStageBadge } from "@/components/recruitment/application-stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { formatDate } from "@/lib/format-date";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import type { HrRegisteredApplicant } from "@/lib/types/database";
import { useListParams } from "@/lib/workspace/list-params";
import { formatSort, paginate, parseSort, sortRows } from "@/lib/workspace/table";

export function registeredApplicantName(applicant: HrRegisteredApplicant) {
  const name = [applicant.last_name, [applicant.first_name, applicant.middle_name, applicant.qualifier].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return name || applicant.full_name || applicant.email || "Applicant";
}

export function RegisteredApplicantDrawer({ applicant, onClose }: { applicant: HrRegisteredApplicant | null; onClose: () => void }) {
  return (
    <Drawer description="Registered, has not applied yet" onOpenChange={(open) => { if (!open) onClose(); }} open={Boolean(applicant)} title={applicant ? registeredApplicantName(applicant) : ""}>
      {applicant ? (
        <dl className="space-y-4">
          {[
            ["Applicant number", formatApplicantNumber(applicant.applicant_number) ?? "Not assigned yet"],
            ["Email", applicant.email ?? "—"],
            ["Email status", applicant.email_confirmed ? "Confirmed" : "Not confirmed"],
            ["Mobile", applicant.phone ?? "—"],
            ["Registered", formatDate(applicant.registered_at)],
          ].map(([label, value]) => (
            <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-base break-all">{value}</dd></div>
          ))}
        </dl>
      ) : null}
    </Drawer>
  );
}

const SORT_KEYS = ["name", "registered"] as const;
const SORT_ACCESSORS = { name: (row: HrRegisteredApplicant) => registeredApplicantName(row), registered: (row: HrRegisteredApplicant) => row.registered_at };

export function HrRegisteredApplicants() {
  const applicants = useHrRegisteredApplicants();
  const { params, set, clear } = useListParams(["rq", "applied", "rsort", "rpage"] as const);
  const [open, setOpen] = useState<HrRegisteredApplicant | null>(null);
  const term = params.rq.toLowerCase();
  const sort = parseSort(params.rsort, SORT_KEYS, { key: "registered", direction: "desc" });
  const filtered = (applicants.data ?? []).filter((applicant) =>
    (params.applied !== "applied" || applicant.application_count > 0)
    && (params.applied !== "not-yet" || applicant.application_count === 0)
    && (!term || [registeredApplicantName(applicant), applicant.email, applicant.phone].some((value) => value?.toLowerCase().includes(term))));
  const page = paginate(sortRows(filtered, sort, SORT_ACCESSORS), Number(params.rpage || 1), 25);

  const columns: DataTableColumn<HrRegisteredApplicant>[] = [
    { key: "name", header: "Applicant", sortable: true, cell: (row) => {
      const name = registeredApplicantName(row);
      return (
        <div>
          {row.latest_application_id
            ? <Link className="font-medium hover:underline" href={`/hr/applications/${row.latest_application_id}`}>{name}</Link>
            : <button className="font-medium hover:underline" onClick={() => setOpen(row)} type="button">{name}</button>}
          {row.applicant_number !== null ? <p className="text-sm text-muted-foreground tabular-nums">{formatApplicantNumber(row.applicant_number)}</p> : null}
        </div>
      );
    } },
    { key: "email", header: "Email", cell: (row) => <span className="inline-flex flex-wrap items-center gap-2 break-all">{row.email ?? "—"}{row.email_confirmed ? null : <Badge variant="warning">Unconfirmed</Badge>}</span> },
    { key: "mobile", header: "Mobile", hideBelow: "lg", cell: (row) => <span className="tabular-nums">{row.phone ?? "—"}</span> },
    { key: "registered", header: "Registered", sortable: true, hideBelow: "md", cell: (row) => <span className="tabular-nums">{formatDate(row.registered_at)}</span> },
    { key: "stage", header: "Latest stage", cell: (row) => row.latest_application_status ? <ApplicationStageBadge status={row.latest_application_status} /> : <span className="text-muted-foreground">Not yet applied</span> },
  ];

  const filtersActive = Boolean(params.rq || params.applied);
  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchInput label="Search registered applicants" onChange={(rq) => set({ rq, rpage: "" }, { keepPage: true })} placeholder="Search name, email or mobile" value={params.rq} />
        <NativeSelect aria-label="Application" className="w-48" onChange={(event) => set({ applied: event.target.value, rpage: "" }, { keepPage: true })} value={params.applied}>
          <option value="">All accounts</option>
          <option value="applied">Applied</option>
          <option value="not-yet">Not yet applied</option>
        </NativeSelect>
      </FilterBar>
      <DataTable
        caption="Registered applicant accounts"
        columns={columns}
        empty={filtersActive
          ? <EmptyState action={<Button onClick={() => clear(["rq", "applied", "rpage"])} variant="outline">Clear filters</Button>} title="No applicants match" />
          : <EmptyState title="No applicant accounts yet" />}
        error={applicants.error?.message}
        footer={page.total ? <Pagination from={page.from} noun="applicants" onPageChange={(next) => set({ rpage: String(next) }, { keepPage: true })} page={page.page} pageCount={page.pageCount} to={page.to} total={page.total} /> : null}
        getRowHref={(row) => (row.latest_application_id ? `/hr/applications/${row.latest_application_id}` : null)}
        getRowKey={(row) => row.user_id}
        isLoading={applicants.isLoading}
        loadingLabel="Loading applicants…"
        onRetry={() => void applicants.refetch()}
        onSortChange={(next) => set({ rsort: formatSort(next), rpage: "" }, { keepPage: true })}
        rows={page.rows}
        sort={sort}
      />
      <RegisteredApplicantDrawer applicant={open} onClose={() => setOpen(null)} />
    </div>
  );
}
