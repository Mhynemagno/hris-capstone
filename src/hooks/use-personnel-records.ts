"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  deletePersonnelEntry,
  getEmployee,
  getEmployeeForCurrentUser,
  listEmployees,
  listPersonnelEntries,
  saveEmployee,
  savePersonnelEntry,
  type PersonnelKind,
} from "@/queries/personnel-records";
import type { EmployeeDirectoryFilters, EmployeeInput, ServiceHistoryInput, QualificationInput, CertificationInput, TrainingRecordInput } from "@/schemas/personnel-records";

export function useEmployeeDirectory(filters: Partial<EmployeeDirectoryFilters> = {}) {
  return useQuery({ queryKey: queryKeys.personnelRecords.directory(filters), queryFn: () => listEmployees(filters) });
}

export function useEmployee(employeeId: string) {
  return useQuery({ queryKey: queryKeys.personnelRecords.detail(employeeId), queryFn: () => getEmployee(employeeId), enabled: Boolean(employeeId) });
}

export function useEmployeeForCurrentUser() {
  return useQuery({ queryKey: ["personnel-records", "current-user"] as const, queryFn: getEmployeeForCurrentUser });
}

export function usePersonnelEntries(kind: PersonnelKind, employeeId: string) {
  const key = kind === "serviceHistory" ? queryKeys.personnelRecords.serviceHistory(employeeId) : kind === "qualification" ? queryKeys.personnelRecords.qualifications(employeeId) : kind === "certification" ? queryKeys.personnelRecords.certifications(employeeId) : queryKeys.personnelRecords.training(employeeId);
  return useQuery({ queryKey: key, queryFn: () => listPersonnelEntries(kind, employeeId), enabled: Boolean(employeeId) });
}

export function useSaveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, employeeId }: { input: EmployeeInput; employeeId?: string }) => saveEmployee(input, employeeId),
    onSuccess: (employee) => {
      void queryClient.invalidateQueries({ queryKey: ["personnel-records", "directory"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.personnelRecords.detail(employee.id) });
    },
  });
}

type ChildInput = ServiceHistoryInput | QualificationInput | CertificationInput | TrainingRecordInput;

export function useSavePersonnelEntry(kind: PersonnelKind, employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: ChildInput; id?: string }) => savePersonnelEntry(kind, input, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.personnelRecords.detail(employeeId) });
      void queryClient.invalidateQueries({ queryKey: ["personnel-records", kind, employeeId] });
    },
  });
}

export function useDeletePersonnelEntry(kind: PersonnelKind, employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePersonnelEntry(kind, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.personnelRecords.detail(employeeId) });
      void queryClient.invalidateQueries({ queryKey: ["personnel-records", kind, employeeId] });
    },
  });
}
