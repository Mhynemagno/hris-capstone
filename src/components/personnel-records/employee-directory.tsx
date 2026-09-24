"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { NativeSelect } from "@/components/ui/native-select";
import { useDepartmentOptions, usePositionOptions } from "@/hooks/use-administration";
import { useEmployeeDirectory, useUnlinkedEmployeeAccounts } from "@/hooks/use-personnel-records";
import type { Employee } from "@/lib/types/database";

import { DepartmentPositionFields } from "./department-position-fields";
import { EmployeeAccountPicker } from "./employee-account-picker";

const employmentStatusLabels: Record<Employee["employment_status"], string> = {
  active: "Active",
  on_leave: "On leave",
  inactive: "Inactive",
  separated: "Separated",
};

export function EmployeeDirectory() {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<Employee["employment_status"] | "">("");
  const { data, error, isLoading } = useEmployeeDirectory({
    search,
    departmentId: departmentId ? Number(departmentId) : undefined,
    positionId: positionId ? Number(positionId) : undefined,
    employmentStatus: employmentStatus || undefined,
  });
  const accounts = useUnlinkedEmployeeAccounts();
  const departments = useDepartmentOptions();
  const positions = usePositionOptions();
  const departmentNames = useMemo(() => new Map((departments.data ?? []).map((row) => [row.id, row.name])), [departments.data]);
  const positionTitles = useMemo(() => new Map((positions.data ?? []).map((row) => [row.id, row.title])), [positions.data]);
  const hasFilters = Boolean(search || departmentId || positionId || employmentStatus);
  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  function clearFilters() {
    setSearch("");
    setDepartmentId("");
    setPositionId("");
    setEmploymentStatus("");
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link className={buttonVariants({ className: "w-full sm:w-auto" })} href="/hr/employees/new">Add employee</Link>
      </div>
      {accounts.isLoading ? <LoadingState label="Loading Employee accounts awaiting a record…" /> : null}
      {accounts.error ? <ErrorState message={accounts.error.message} /> : null}
      {accounts.data ? <EmployeeAccountPicker accounts={accounts.data} /> : null}
      <section aria-label="Filter employees" className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <FormField htmlFor="employee-search" label="Search">
          <Input id="employee-search" onChange={(event) => setSearch(event.target.value)} placeholder="Name or badge number" type="search" value={search} />
        </FormField>
        <DepartmentPositionFields
          activeOnly={false}
          departmentId={departmentId}
          departmentPlaceholder="All departments"
          idPrefix="employee-filter"
          onDepartmentChange={setDepartmentId}
          onPositionChange={setPositionId}
          positionId={positionId}
          positionPlaceholder="All positions"
        />
        <FormField htmlFor="employee-filter-status" label="Employment status">
          <NativeSelect id="employee-filter-status" onChange={(event) => setEmploymentStatus(event.target.value as Employee["employment_status"] | "")} value={employmentStatus}>
            <option value="">All statuses</option>
            {(Object.keys(employmentStatusLabels) as Employee["employment_status"][]).map((status) => <option key={status} value={status}>{employmentStatusLabels[status]}</option>)}
          </NativeSelect>
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {isLoading ? "Searching…" : total > rows.length ? `Showing ${rows.length} of ${total} records` : total === 1 ? "1 record" : `${total} records`}
          </p>
          <Button disabled={!hasFilters} onClick={clearFilters} type="button" variant="outline">Clear filters</Button>
        </div>
      </section>
      {isLoading ? <LoadingState label="Loading personnel records…" /> : error ? <ErrorState message={error.message} /> : (
        <div className="relative overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Personnel records</caption>
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Employee</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Badge number</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Department</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Position</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Status</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((employee) => (
                <tr className="border-t" key={employee.id}>
                  <td className="px-4 py-3 align-top font-medium">{employee.first_name} {employee.last_name}</td>
                  <td className="px-4 py-3 align-top tabular-nums">{employee.employee_number}</td>
                  <td className="px-4 py-3 align-top">{employee.department_id ? departmentNames.get(employee.department_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 align-top">{employee.position_id ? positionTitles.get(employee.position_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 align-top">{employmentStatusLabels[employee.employment_status]}</td>
                  <td className="px-4 py-3 align-top text-right">
                    <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/hr/employees/${employee.id}`}>
                      View record{" "}<span className="sr-only">for {employee.first_name} {employee.last_name}</span>
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={6}>
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
    </div>
  );
}
