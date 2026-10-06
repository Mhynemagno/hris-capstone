"use client";

import type { ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useEmployeeForCurrentUser, usePersonnelEntries } from "@/hooks/use-personnel-records";
import type { Certification, Qualification, ServiceHistory, TrainingRecord } from "@/lib/types/database";

import { EmployeeProfile } from "./employee-profile";

export function EmployeeRecordSummary({ actions, variant = "full" }: { actions?: ReactNode; variant?: "full" | "summary" } = {}) {
  const employee = useEmployeeForCurrentUser();
  const employeeId = variant === "full" ? employee.data?.id ?? "" : "";
  const trainings = usePersonnelEntries("training", employeeId);
  const qualifications = usePersonnelEntries("qualification", employeeId);
  const serviceHistory = usePersonnelEntries("serviceHistory", employeeId);
  const certifications = usePersonnelEntries("certification", employeeId);
  if (employee.isLoading) return <LoadingState label="Loading your personnel record…" />;
  if (employee.error) return <ErrorState message={employee.error.message} />;
  if (!employee.data) return <div className="space-y-4"><p className="rounded-xl border p-5 text-sm text-muted-foreground">Your official personnel record has not been linked to this account yet. Contact HR for help.</p>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</div>;
  const recordError = trainings.error ?? qualifications.error ?? serviceHistory.error ?? certifications.error;
  if (recordError) return <ErrorState message={recordError.message} />;
  return <EmployeeProfile actions={actions} canEditGovernmentIds canManagePhoto certifications={(certifications.data ?? []) as Certification[]} employee={employee.data} qualifications={(qualifications.data ?? []) as Qualification[]} serviceHistory={(serviceHistory.data ?? []) as ServiceHistory[]} trainings={(trainings.data ?? []) as TrainingRecord[]} variant={variant} />;
}
