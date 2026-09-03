"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  deletePersonnelEntry,
  getEmployee,
  getEmployeeForCurrentUser,
  getEmployeeForProfile,
  getEmployeeProfilePhotoUrl,
  listEmployees,
  listUnlinkedEmployeeAccounts,
  listPersonnelEntries,
  saveEmployee,
  savePersonnelEntry,
  replaceMyEmployeeProfilePhoto,
  removeMyEmployeeProfilePhoto,
  type PersonnelKind,
} from "@/queries/personnel-records";
import type { EmployeeDirectoryFilters, EmployeeInput, ServiceHistoryInput, QualificationInput, CertificationInput, TrainingRecordInput } from "@/schemas/personnel-records";

export function useEmployeeDirectory(filters: Partial<EmployeeDirectoryFilters> = {}) {
  return useQuery({ queryKey: queryKeys.personnelRecords.directory(filters), queryFn: () => listEmployees(filters) });
}

export function useUnlinkedEmployeeAccounts() {
  return useQuery({ queryKey: queryKeys.personnelRecords.unlinkedAccounts(), queryFn: listUnlinkedEmployeeAccounts });
}

export function useEmployee(employeeId: string) {
  return useQuery({ queryKey: queryKeys.personnelRecords.detail(employeeId), queryFn: () => getEmployee(employeeId), enabled: Boolean(employeeId) });
}

export function useEmployeeForCurrentUser() {
  return useQuery({ queryKey: ["personnel-records", "current-user"] as const, queryFn: getEmployeeForCurrentUser });
}

export function useEmployeeForProfile(profileId: string) {
  return useQuery({ queryKey: ["personnel-records", "profile", profileId] as const, queryFn: () => getEmployeeForProfile(profileId), enabled: Boolean(profileId) });
}

export function useEmployeeProfilePhotoUrl(objectPath: string | null) {
  return useQuery({ queryKey: queryKeys.personnelRecords.profilePhoto(objectPath), queryFn: () => getEmployeeProfilePhotoUrl(objectPath), enabled: Boolean(objectPath) });
}

export function useReplaceMyEmployeeProfilePhoto(employee: { id: string; profile_image_path: string | null }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => replaceMyEmployeeProfilePhoto(employee, file),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["personnel-records", "current-user"] }); },
  });
}

export function useRemoveMyEmployeeProfilePhoto(employee: { id: string; profile_image_path: string | null }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeMyEmployeeProfilePhoto(employee),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["personnel-records", "current-user"] }); },
  });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.personnelRecords.unlinkedAccounts() });
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
