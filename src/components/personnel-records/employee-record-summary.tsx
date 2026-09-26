"use client";

import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeForCurrentUser, usePersonnelEntries } from "@/hooks/use-personnel-records";
import type { TrainingRecord } from "@/lib/types/database";

import { EmployeeProfile } from "./employee-profile";

export function EmployeeRecordSummary({ actions }: { actions?: ReactNode } = {}) {
  const employee = useEmployeeForCurrentUser();
  const trainings = usePersonnelEntries("training", employee.data?.id ?? "");
  if (employee.isLoading) return <LoadingState label="Loading your personnel record…" />;
  if (employee.error) return <ErrorState message={employee.error.message} />;
  if (!employee.data) return <div className="space-y-4"><p className="rounded-xl border p-5 text-sm text-muted-foreground">Your official personnel record has not been linked to this account yet. Contact HR for help.</p>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</div>;
  if (trainings.error) return <ErrorState message={trainings.error.message} />;
  return <EmployeeProfile actions={actions} canManagePhoto employee={employee.data} trainings={(trainings.data ?? []) as TrainingRecord[]} />;
}
