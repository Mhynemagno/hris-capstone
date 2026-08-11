"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeForCurrentUser } from "@/hooks/use-personnel-records";

export function EmployeeRecordSummary() {
  const employee = useEmployeeForCurrentUser();
  if (employee.isLoading) return <LoadingState label="Loading your personnel record…" />;
  if (employee.error) return <ErrorState message={employee.error.message} />;
  if (!employee.data) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">Your official personnel record has not been linked to this account yet. Contact HR for help.</p>;
  return <section className="rounded-xl border bg-card p-6"><p className="text-sm font-medium text-primary">Official record</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{employee.data.first_name} {employee.data.last_name}</h1><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Employee number</dt><dd className="mt-1 font-medium">{employee.data.employee_number}</dd></div><div><dt className="text-muted-foreground">Employment status</dt><dd className="mt-1 font-medium capitalize">{employee.data.employment_status.replace("_", " ")}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 font-medium">{employee.data.personal_email}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="mt-1 font-medium">{employee.data.phone ?? "Not recorded"}</dd></div></dl><p className="mt-6 text-sm text-muted-foreground">Official fields are managed by HR. Profile-change requests are introduced in a later workflow.</p></section>;
}
