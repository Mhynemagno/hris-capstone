"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeDirectory, useUnlinkedEmployeeAccounts } from "@/hooks/use-personnel-records";

import { EmployeeAccountPicker } from "./employee-account-picker";

export function EmployeeDirectory() {
  const [search, setSearch] = useState("");
  const { data, error, isLoading } = useEmployeeDirectory({ search });
  const accounts = useUnlinkedEmployeeAccounts();
  if (isLoading) return <LoadingState label="Loading personnel records…" />;
  if (error) return <ErrorState message={error.message} />;
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><label className="sr-only" htmlFor="employee-search">Search employees</label><input className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm sm:w-80" id="employee-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or Badge Number" value={search} /><Link className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto" href="/hr/employees/new">Add employee</Link></div>
    {accounts.isLoading ? <LoadingState label="Loading Employee accounts awaiting a record…" /> : null}
    {accounts.error ? <ErrorState message={accounts.error.message} /> : null}
    {accounts.data ? <EmployeeAccountPicker accounts={accounts.data} /> : null}
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-muted/70 text-muted-foreground"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Number</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"><span className="sr-only">Open record</span></th></tr></thead><tbody>{data?.rows.length ? data.rows.map((employee) => <tr className="border-t" key={employee.id}><td className="px-5 py-3 font-medium">{employee.first_name} {employee.last_name}</td><td className="px-5 py-3 tabular-nums">{employee.employee_number}</td><td className="px-5 py-3 capitalize">{employee.employment_status.replace("_", " ")}</td><td className="px-5 py-3 text-right"><Link className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={`/hr/employees/${employee.id}`}>View record</Link></td></tr>) : <tr><td className="px-5 py-10 text-center text-muted-foreground" colSpan={4}>No personnel records match this search.</td></tr>}</tbody></table></div>
  </div>;
}
