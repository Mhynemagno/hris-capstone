"use client";

import Link from "next/link";
import { MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { RegisteredApplicantDrawer } from "@/components/recruitment/hr-registered-applicants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { useAllHrApplications, useAllHrJobs } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { APPLICATION_SORT_ACCESSORS, buildApplicationRows, parseApplicationListParams, QUICK_VIEWS, type ApplicationListRow } from "@/lib/recruitment/application-list";
import { applicationStatusLabel } from "@/lib/recruitment/stage-results";
import type { HrRegisteredApplicant } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useListParams } from "@/lib/workspace/list-params";
import { formatSort, paginate, sortRows } from "@/lib/workspace/table";
import { applicationStatusSchema } from "@/schemas/recruitment";

const KEYS = ["quick", "stage", "job", "q", "ai", "minScore", "sort", "page"] as const;
const AI_LABELS: Record<string, string> = { queued: "Queued", processing: "Analyzing", completed: "Completed", failed: "Failed", unscored: "Not analyzed" };

function initials(name: string) {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function AiMatch({ row }: { row: Extract<ApplicationListRow, { kind: "application" }> }) {
  if (row.aiStatus === "completed" && row.aiScore !== null) {
    return (
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, row.aiScore)}%` }} /></span>
        <span className="font-medium tabular-nums">{row.aiScore}</span>
      </span>
    );
  }
  const text = row.aiStatus === "failed" ? "Analysis failed" : row.aiStatus === "unscored" ? "Not analyzed" : row.aiStatus === "queued" ? "Queued" : "Analyzing";
  return <span className={cn("text-sm text-muted-foreground", row.aiStatus === "failed" && "text-destructive")}>{text}</span>;
}

export function HrApplications() {
  const { params: raw, set, clear } = useListParams(KEYS);
  const params = parseApplicationListParams(raw);
  const applications = useAllHrApplications({ aiStatus: params.ai || undefined, minimumScore: params.minScore });
  const registered = useHrRegisteredApplicants();
  const jobs = useAllHrJobs();
  const [drawer, setDrawer] = useState<HrRegisteredApplicant | null>(null);

  const rows = buildApplicationRows(applications.data ?? [], registered.data ?? [], params);
  const page = paginate(sortRows(rows, params.sort, APPLICATION_SORT_ACCESSORS), params.page, 25);
  const jobTitle = (id: number) => jobs.data?.find((job) => job.id === id)?.title ?? `Posting ${id}`;

  const chips = [
    params.stage ? { key: "stage", label: `Stage: ${params.stage}`, onRemove: () => set({ stage: "" }) } : null,
    params.job ? { key: "job", label: `Job: ${jobTitle(params.job)}`, onRemove: () => set({ job: "" }) } : null,
    params.ai ? { key: "ai", label: `AI: ${AI_LABELS[params.ai]}`, onRemove: () => set({ ai: "" }) } : null,
    params.minScore !== undefined ? { key: "minScore", label: `Score ≥ ${params.minScore}`, onRemove: () => set({ minScore: "" }) } : null,
    params.q ? { key: "q", label: `Search: ${params.q}`, onRemove: () => set({ q: "" }) } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null);

  const columns: DataTableColumn<ApplicationListRow>[] = [
    { key: "name", header: "Applicant", sortable: true, cell: (row) => (
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">{initials(row.name)}</span>
        <div className="min-w-0">
          {row.kind === "application"
            ? <Link className="font-medium hover:underline" href={`/hr/applications/${row.id}`}>{row.name}</Link>
            : <button className="font-medium hover:underline" onClick={() => setDrawer(row.applicant)} type="button">{row.name}</button>}
          {row.applicantNumber ? <p className="text-sm text-muted-foreground tabular-nums">{row.applicantNumber}</p> : null}
        </div>
      </div>
    ) },
    { key: "job", header: "Job posting", hideBelow: "md", cell: (row) => <span className="text-secondary-foreground">{row.kind === "application" ? (row.jobTitle ?? "—") : "—"}</span> },
    { key: "stage", header: "Status", cell: (row) => {
      if (row.kind !== "application") return <Badge variant="warning">Not yet applied</Badge>;
      const status = applicationStatusLabel(row.status, row.stageResult);
      return <div className="space-y-1"><Badge variant={status.variant}>{status.label}</Badge><p className="text-sm text-muted-foreground">{row.status}</p></div>;
    } },
    { key: "ai", header: "AI match", sortable: true, cell: (row) => row.kind === "application" ? <AiMatch row={row} /> : <span className="text-muted-foreground">—</span> },
    { key: "submitted", header: "Submitted", sortable: true, hideBelow: "lg", cell: (row) => <span className="tabular-nums text-secondary-foreground">{formatDate(row.submittedAt)}</span> },
    { key: "actions", header: "Actions", align: "right", cell: (row) => {
      if (row.kind !== "application") return null;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label={`Actions for ${row.name}`} size="icon-sm" variant="ghost" />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<a href={`/hr/applications/${row.id}`} rel="noreferrer" target="_blank" />}>Open in new tab</DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/hr/applications/${row.id}`} />}>Open application</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } },
  ];

  const hasFilters = chips.length > 0 || params.quick !== "active";
  const noApplicationsAtAll = !applications.isLoading && !(applications.data ?? []).length && !hasFilters;

  return (
    <div className="space-y-4">
      <div aria-label="Quick views" className="inline-flex flex-wrap gap-1 rounded-md border bg-card p-1" role="group">
        {QUICK_VIEWS.map((view) => (
          <button aria-pressed={!params.stage && !params.job && params.quick === view.value} className="rounded px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-primary-subtle aria-pressed:text-primary" key={view.value} onClick={() => set({ quick: view.value === "active" ? "" : view.value, stage: "", job: "" })} type="button">{view.label}</button>
        ))}
      </div>
      <FilterBar chips={chips} onClearAll={chips.length ? () => clear(["stage", "job", "ai", "minScore", "q"]) : undefined}>
        <SearchInput label="Search applications" onChange={(q) => set({ q })} placeholder="Search name or applicant number" value={params.q} />
        <NativeSelect aria-label="Job posting" className="w-52" onChange={(event) => set({ job: event.target.value })} value={params.job ? String(params.job) : ""}>
          <option value="">All job postings</option>
          {(jobs.data ?? []).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Stage" className="w-48" onChange={(event) => set({ stage: event.target.value })} value={params.stage}>
          <option value="">All stages</option>
          {applicationStatusSchema.options.map((status) => <option key={status} value={status}>{status}</option>)}
        </NativeSelect>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}><SlidersHorizontal aria-hidden="true" />More filters</PopoverTrigger>
          <PopoverContent>
            <div className="space-y-4">
              <FormField htmlFor="filter-ai-status" label="AI analysis status">
                <NativeSelect id="filter-ai-status" onChange={(event) => set({ ai: event.target.value })} value={params.ai}>
                  <option value="">All results</option>
                  {Object.entries(AI_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </NativeSelect>
              </FormField>
              <FormField htmlFor="filter-min-score" label="Minimum AI score (0–100)">
                <Input id="filter-min-score" inputMode="numeric" max={100} min={0} onChange={(event) => set({ minScore: event.target.value })} placeholder="Any score" type="number" value={params.minScore ?? ""} />
              </FormField>
            </div>
          </PopoverContent>
        </Popover>
      </FilterBar>
      <DataTable
        caption="Applications"
        columns={columns}
        empty={noApplicationsAtAll
          ? <EmptyState action={<Link className="font-medium text-primary hover:underline" href="/hr/jobs">Go to job postings</Link>} description="Applicants appear here once they apply to a published posting." title="No applications yet" />
          : <EmptyState action={<Button onClick={() => clear(["quick", "stage", "job", "ai", "minScore", "q"])} variant="outline">Clear filters</Button>} title="No applications match these filters" />}
        error={applications.error?.message ?? registered.error?.message}
        footer={page.total ? <Pagination from={page.from} noun="applications" onPageChange={(next) => set({ page: String(next) })} page={page.page} pageCount={page.pageCount} to={page.to} total={page.total} /> : null}
        getRowHref={(row) => (row.kind === "application" ? `/hr/applications/${row.id}` : null)}
        getRowKey={(row) => `${row.kind}-${row.id}`}
        isLoading={applications.isLoading}
        loadingLabel="Loading applications…"
        onRetry={() => void applications.refetch()}
        onSortChange={(next) => set({ sort: formatSort(next) })}
        rows={page.rows}
        sort={params.sort}
      />
      <RegisteredApplicantDrawer applicant={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
