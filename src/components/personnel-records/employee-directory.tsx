"use client";

import Link from "next/link";
import { Eye, Pencil, Plus, Search, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { DeleteRecordDialog } from "@/components/deletion/delete-record-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { NativeSelect } from "@/components/ui/native-select";
import { useRankOptions } from "@/hooks/use-administration";
import { useEmployeeDirectory, useEmployeeProfilePhotoUrl, useUnlinkedEmployeeAccounts } from "@/hooks/use-personnel-records";
import type { Employee } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import { DepartmentRankFields } from "./department-rank-fields";
import { EmployeeAccountPicker } from "./employee-account-picker";

const employmentStatusLabels: Record<Employee["employment_status"], string> = {
  active: "Active",
  on_leave: "On leave",
};

const statusStyles: Record<Employee["employment_status"], string> = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/30",
  on_leave: "bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-400/30",
};

const iconAction = "inline-flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function EmployeeAvatar({ employee }: { employee: Employee }) {
  const photo = useEmployeeProfilePhotoUrl(employee.profile_image_path);
  return (
    <Avatar className="size-11">
      {photo.data ? <AvatarImage alt="" src={photo.data} /> : null}
      <AvatarFallback className="bg-muted text-muted-foreground">
        <UserRound aria-hidden="true" className="size-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function Blank() {
  return <span aria-label="Not provided" className="text-muted-foreground">—</span>;
}

export function EmployeeDirectory() {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [rankId, setRankId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<Employee["employment_status"] | "">("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { data, error, isLoading } = useEmployeeDirectory({
    search,
    departmentId: departmentId ? Number(departmentId) : undefined,
    rankId: rankId ? Number(rankId) : undefined,
    employmentStatus: employmentStatus || undefined,
  });
  const accounts = useUnlinkedEmployeeAccounts();
  const ranks = useRankOptions();
  const rankCodes = useMemo(() => new Map((ranks.data ?? []).map((row) => [row.id, row.code])), [ranks.data]);
  const activeFilterCount = [departmentId, rankId, employmentStatus].filter(Boolean).length;
  const hasFilters = Boolean(search) || activeFilterCount > 0;
  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  function clearFilters() {
    setSearch("");
    setDepartmentId("");
    setRankId("");
    setEmploymentStatus("");
  }

  return (
    <div className="space-y-5">
      {accounts.isLoading ? <LoadingState label="Loading Employee accounts awaiting a record…" /> : null}
      {accounts.error ? <ErrorState message={accounts.error.message} /> : null}
      {accounts.data ? <EmployeeAccountPicker accounts={accounts.data} /> : null}

      <section aria-label="Employee list" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <label className="sr-only" htmlFor="employee-search">Search</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" id="employee-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or badge number" type="search" value={search} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button aria-controls="employee-filters" aria-expanded={filtersOpen} className="min-h-11" onClick={() => setFiltersOpen((open) => !open)} type="button" variant="outline">
              <SlidersHorizontal aria-hidden="true" />
              Filter
              {activeFilterCount ? <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{activeFilterCount}</span> : null}
            </Button>
            <Link className={buttonVariants({ className: "min-h-11" })} href="/hr/employees/new">
              <Plus aria-hidden="true" />
              Add New Employee
            </Link>
          </div>
        </div>

        <div className="grid gap-4 border-b bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4" hidden={!filtersOpen} id="employee-filters">
          <DepartmentRankFields
            activeOnly={false}
            departmentId={departmentId}
            departmentPlaceholder="All departments"
            idPrefix="employee-filter"
            onDepartmentChange={setDepartmentId}
            onRankChange={setRankId}
            rankId={rankId}
            rankPlaceholder="All ranks"
          />
          <FormField htmlFor="employee-filter-status" label="Employment status">
            <NativeSelect id="employee-filter-status" onChange={(event) => setEmploymentStatus(event.target.value as Employee["employment_status"] | "")} value={employmentStatus}>
              <option value="">All statuses</option>
              {(Object.keys(employmentStatusLabels) as Employee["employment_status"][]).map((status) => <option key={status} value={status}>{employmentStatusLabels[status]}</option>)}
            </NativeSelect>
          </FormField>
          <div className="flex items-end">
            <Button className="min-h-11 w-full" disabled={!hasFilters} onClick={clearFilters} type="button" variant="ghost">Clear filters</Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-muted-foreground">
          <p aria-live="polite">
            {isLoading ? "Searching…" : total > rows.length ? `Showing ${rows.length} of ${total} records` : total === 1 ? "1 record" : `${total} records`}
          </p>
          <p aria-live="polite" className="font-medium text-emerald-700 dark:text-emerald-400" role="status">{notice ?? ""}</p>
        </div>

        {isLoading ? <div className="p-4"><LoadingState label="Loading personnel records…" /></div> : error ? <div className="p-4"><ErrorState message={error.message} /></div> : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <caption className="sr-only">Personnel records</caption>
              <thead className="border-y bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="w-16 px-4 py-3" scope="col"><span className="sr-only">Photo</span></th>
                  <th className="px-4 py-3 font-semibold" scope="col">Rank</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Last Name</th>
                  <th className="px-4 py-3 font-semibold" scope="col">First Name</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Middle Name</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Qualifier</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Status</th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length ? rows.map((employee) => {
                  const name = `${employee.first_name} ${employee.last_name}`;
                  return (
                    <tr className="transition-colors hover:bg-muted/40" key={employee.id}>
                      <Cell><EmployeeAvatar employee={employee} /></Cell>
                      <Cell className="font-semibold">{employee.rank_id ? rankCodes.get(employee.rank_id) ?? <Blank /> : <Blank />}</Cell>
                      <Cell className="font-medium">
                        {employee.last_name}
                        <span className="block text-xs font-normal text-muted-foreground tabular-nums">{employee.employee_number}</span>
                      </Cell>
                      <Cell>{employee.first_name}</Cell>
                      <Cell>{employee.middle_name || <Blank />}</Cell>
                      <Cell>{employee.qualifier || <Blank />}</Cell>
                      <Cell>
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", statusStyles[employee.employment_status])}>
                          {employmentStatusLabels[employee.employment_status]}
                        </span>
                      </Cell>
                      <Cell>
                        <div className="flex justify-end gap-1">
                          <Link aria-label={`View record for ${name}`} className={cn(iconAction, "text-foreground hover:bg-muted")} href={`/hr/employees/${employee.id}`} title="View">
                            <Eye aria-hidden="true" className="size-5" />
                          </Link>
                          <Link aria-label={`Edit record for ${name}`} className={cn(iconAction, "text-foreground hover:bg-muted")} href={`/hr/employees/${employee.id}?tab=official`} title="Edit">
                            <Pencil aria-hidden="true" className="size-[18px]" />
                          </Link>
                          <button
                            aria-label={`Delete record for ${name}`}
                            className={cn(iconAction, "cursor-pointer text-destructive hover:bg-destructive/10")}
                            onClick={() => { setNotice(null); setDeleting(employee.id); }}
                            title="Delete"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="size-[18px]" />
                          </button>
                        </div>
                      </Cell>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                      {hasFilters ? "No personnel records match these filters. Clear the filters to see every record." : (
                        <>No personnel records yet. <Link className="font-medium text-primary underline underline-offset-4" href="/hr/employees/new">Add the first employee</Link>.</>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DeleteRecordDialog
        entityId={deleting}
        entityType="employee"
        noun="personnel record"
        onClose={() => setDeleting(null)}
        onDeleted={() => setNotice("The personnel record was permanently deleted.")}
      />
    </div>
  );
}
