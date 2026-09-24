"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getOrganizationSettings,
  deleteManagedUser,
  inviteInternalUser,
  listAuditLogs,
  listDepartmentOptions,
  listDepartments,
  listManagedUsers,
  listRankOptions,
  listRanks,
  listUnitStationCatalogue,
  saveDepartment,
  saveOrganizationSettings,
  saveRank,
  saveUnitStation,
  updateManagedUser,
} from "@/queries/administration";
import {
  auditLogFiltersSchema,
  managedUserFiltersSchema,
  referenceDataFiltersSchema,
  type AuditLogFilters,
  type DepartmentInput,
  type InternalInvitationInput,
  type ManagedUserFilters,
  type ManagedUserDeleteInput,
  type ManagedUserUpdateInput,
  type OrganizationSettingsInput,
  type RankInput,
  type UnitStationInput,
  type ReferenceDataFilters,
} from "@/schemas/administration";

function managedFilters(filters: Partial<ManagedUserFilters> = {}) {
  return managedUserFiltersSchema.parse({ page: 1, pageSize: 20, ...filters });
}

function referenceFilters(filters: Partial<ReferenceDataFilters> = {}) {
  return referenceDataFiltersSchema.parse({ page: 1, pageSize: 20, ...filters });
}

function auditFilters(filters: Partial<AuditLogFilters> = {}) {
  return auditLogFiltersSchema.parse({ page: 1, pageSize: 20, ...filters });
}

export function useManagedUsers(filters: Partial<ManagedUserFilters> = {}) {
  const parsed = managedFilters(filters);
  return useQuery({ queryKey: queryKeys.administration.users(parsed), queryFn: () => listManagedUsers(parsed) });
}

export function useManagedRoles(filters: Partial<ManagedUserFilters> = {}) {
  const parsed = managedFilters(filters);
  return useQuery({ queryKey: queryKeys.administration.roles(parsed), queryFn: () => listManagedUsers(parsed) });
}

export function useDepartments(filters: Partial<ReferenceDataFilters> = {}) {
  const parsed = referenceFilters(filters);
  return useQuery({ queryKey: queryKeys.administration.departments(parsed), queryFn: () => listDepartments(parsed) });
}

export function useRanks(filters: Partial<ReferenceDataFilters> = {}) {
  const parsed = referenceFilters(filters);
  return useQuery({ queryKey: queryKeys.administration.ranks(parsed), queryFn: () => listRanks(parsed) });
}

/** All departments for dropdowns (not paginated). */
export function useDepartmentOptions() {
  return useQuery({ queryKey: queryKeys.administration.departments({ options: true }), queryFn: listDepartmentOptions });
}

/** All ranks for dropdowns (not paginated), junior to senior. Every rank applies to every department. */
export function useRankOptions() {
  return useQuery({ queryKey: queryKeys.administration.ranks({ options: true }), queryFn: listRankOptions });
}

export function useOrganizationSettings() {
  return useQuery({ queryKey: queryKeys.administration.settings(), queryFn: getOrganizationSettings });
}

export function useAuditLogs(filters: Partial<AuditLogFilters> = {}) {
  const parsed = auditFilters(filters);
  return useQuery({ queryKey: queryKeys.administration.auditLogs(parsed), queryFn: () => listAuditLogs(parsed) });
}

function useAdministrationMutations() {
  const queryClient = useQueryClient();
  return {
    invalidate: (...keys: string[]) => keys.forEach((key) => void queryClient.invalidateQueries({ queryKey: ["administration", key] })),
  };
}

export function useInviteInternalUser() {
  const { invalidate } = useAdministrationMutations();
  return useMutation({
    mutationFn: (input: InternalInvitationInput) => inviteInternalUser(input),
    onSuccess: () => invalidate("users", "roles", "audit-logs"),
  });
}

export function useUpdateManagedUser() {
  const { invalidate } = useAdministrationMutations();
  return useMutation({
    mutationFn: ({ input }: { input: ManagedUserUpdateInput }) => updateManagedUser(input),
    onSuccess: () => invalidate("users", "roles", "audit-logs"),
  });
}

export function useDeleteManagedUser() {
  const { invalidate } = useAdministrationMutations();
  return useMutation({
    mutationFn: (input: ManagedUserDeleteInput) => deleteManagedUser(input),
    onSuccess: () => invalidate("users", "roles", "audit-logs"),
  });
}

export function useSaveDepartment() {
  const { invalidate } = useAdministrationMutations();
  return useMutation({
    mutationFn: ({ input, departmentId }: { input: DepartmentInput; departmentId?: number }) => saveDepartment(input, departmentId),
    onSuccess: () => invalidate("departments", "audit-logs"),
  });
}

export function useUnitStationCatalogue(filters: Partial<ReferenceDataFilters> = {}) {
  const parsed = referenceFilters(filters);
  return useQuery({ queryKey: queryKeys.administration.unitStations(parsed), queryFn: () => listUnitStationCatalogue(parsed) });
}

export function useSaveUnitStation() {
  const { invalidate } = useAdministrationMutations();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, unitStationId }: { input: UnitStationInput; unitStationId?: number }) => saveUnitStation(input, unitStationId),
    onSuccess: () => {
      invalidate("unit-stations", "audit-logs");
      // Personnel and deployment forms read the active catalogue.
      void queryClient.invalidateQueries({ queryKey: ["personnel-records", "unit-stations"] });
    },
  });
}

export function useSaveRank() {
  const { invalidate } = useAdministrationMutations();
  return useMutation({
    mutationFn: ({ input, rankId }: { input: RankInput; rankId?: number }) => saveRank(input, rankId),
    onSuccess: () => invalidate("ranks", "audit-logs"),
  });
}

export function useSaveOrganizationSettings() {
  const { invalidate } = useAdministrationMutations();
  return useMutation({
    mutationFn: (input: OrganizationSettingsInput) => saveOrganizationSettings(input),
    onSuccess: () => invalidate("settings", "audit-logs"),
  });
}
