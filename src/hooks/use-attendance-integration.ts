"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getAttendanceSettings, importAttendanceFile, listAttendanceEmployees, listAttendanceImports, listHrAttendanceLogs, listMyAttendanceLogs, listUnmatchedAttendanceEvents, resolveUnmatchedAttendanceEvent, saveAttendanceSettings, attendanceFilters } from "@/queries/attendance-integration";
import type { AttendanceFilters } from "@/schemas/attendance-integration";

export function useHrAttendanceLogs(input: Partial<AttendanceFilters> = {}) { const filters = attendanceFilters(input); return useQuery({ queryKey: queryKeys.attendanceIntegration.hrLogs(filters), queryFn: () => listHrAttendanceLogs(filters) }); }
export function useMyAttendanceLogs(input: Partial<AttendanceFilters> = {}) { const filters = attendanceFilters(input); return useQuery({ queryKey: queryKeys.attendanceIntegration.mine(filters), queryFn: () => listMyAttendanceLogs(filters) }); }
export function useAttendanceImports(input: Partial<AttendanceFilters> = {}) { const filters = attendanceFilters(input); return useQuery({ queryKey: queryKeys.attendanceIntegration.imports(filters), queryFn: () => listAttendanceImports(filters) }); }
export function useUnmatchedAttendanceEvents(input: Partial<AttendanceFilters> = {}) { const filters = attendanceFilters(input); return useQuery({ queryKey: queryKeys.attendanceIntegration.unmatched(filters), queryFn: () => listUnmatchedAttendanceEvents(filters) }); }
export function useAttendanceSettings() { return useQuery({ queryKey: queryKeys.attendanceIntegration.settings(), queryFn: getAttendanceSettings }); }
export function useAttendanceEmployees() { return useQuery({ queryKey: ["attendance-integration", "employees"], queryFn: listAttendanceEmployees }); }
function useInvalidateAttendance() { const client = useQueryClient(); return () => { void client.invalidateQueries({ queryKey: ["attendance-integration"] }); void client.invalidateQueries({ queryKey: ["reporting"] }); }; }
export function useImportAttendanceFile() { const invalidate = useInvalidateAttendance(); return useMutation({ mutationFn: importAttendanceFile, onSuccess: invalidate }); }
export function useSaveAttendanceSettings() { const invalidate = useInvalidateAttendance(); return useMutation({ mutationFn: saveAttendanceSettings, onSuccess: invalidate }); }
export function useResolveUnmatchedAttendanceEvent() { const invalidate = useInvalidateAttendance(); return useMutation({ mutationFn: resolveUnmatchedAttendanceEvent, onSuccess: invalidate }); }
