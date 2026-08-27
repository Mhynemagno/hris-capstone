"use client";

import { useParams } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EmployeeProfile } from "@/components/personnel-records/employee-profile";
import { useEmployeeForProfile, usePersonnelEntries } from "@/hooks/use-personnel-records";
import type { TrainingRecord } from "@/lib/types/database";

export default function AdminUserProfilePage() {
  const params = useParams<{ userId: string }>();
  const employee = useEmployeeForProfile(params.userId);
  const trainings = usePersonnelEntries("training", employee.data?.id ?? "");

  if (employee.isLoading) return <LoadingState label="Loading employee profile…" />;
  if (employee.error) return <ErrorState message={employee.error.message} />;
  if (!employee.data) return <ErrorState message="This account is not linked to an employee profile." />;
  if (trainings.error) return <ErrorState message={trainings.error.message} />;
  return <EmployeeProfile employee={employee.data} trainings={(trainings.data ?? []) as TrainingRecord[]} />;
}
