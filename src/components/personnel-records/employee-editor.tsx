"use client";

import { useRouter } from "next/navigation";

import { EmployeeForm } from "./employee-form";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useSaveEmployee, useUnlinkedEmployeeAccounts } from "@/hooks/use-personnel-records";
import type { Employee } from "@/lib/types/database";

export function EmployeeEditor({ employee, profileId }: { employee?: Employee; profileId?: string }) {
  const router = useRouter();
  const save = useSaveEmployee();
  const accounts = useUnlinkedEmployeeAccounts();
  if (profileId && accounts.isLoading) return <LoadingState label="Loading selected Employee account…" />;
  if (profileId && accounts.error) return <ErrorState message={accounts.error.message} />;
  const account = profileId ? accounts.data?.find((candidate) => candidate.profile_id === profileId) : undefined;
  if (profileId && !account) return <ErrorState message="This Employee account is no longer available for a new personnel record." />;
  return <EmployeeForm account={account} employee={employee} pending={save.isPending} onSaved={async (input) => { const result = await save.mutateAsync({ input, employeeId: employee?.id }); router.push(`/hr/employees/${result.id}`); router.refresh(); }} />;
}
