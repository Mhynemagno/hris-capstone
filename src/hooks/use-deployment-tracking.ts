"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { cancelDeployment, createDeploymentGroup, deploymentFilters, getDeployment, listDeploymentReports, listEmployeeIdsOnLeave, listEmployeeOptions, listHrDeployments, listMyDeployments, proposeDeploymentStatus, reviewDeploymentStatus, submitDeploymentReport, updateDeployment, type DeploymentReportInput } from "@/queries/deployment-tracking";
import type { DeploymentFilters } from "@/schemas/deployment-tracking";

export function useHrDeployments(input: Partial<DeploymentFilters> = {}) { const filters = deploymentFilters(input); return useQuery({ queryKey: queryKeys.deploymentTracking.hrDirectory(filters), queryFn: () => listHrDeployments(filters), placeholderData: keepPreviousData }); }
export function useMyDeployments(input: Partial<DeploymentFilters> = {}) { const filters = deploymentFilters(input); return useQuery({ queryKey: queryKeys.deploymentTracking.mine(filters), queryFn: () => listMyDeployments(filters) }); }
/** All employees (capped at 2000) for the deployment employee picker. */
export function useEmployeeOptions() { return useQuery({ queryKey: ["deployment-tracking", "employee-options"], queryFn: listEmployeeOptions, staleTime: 60_000 }); }
/** Employees on approved leave during the chosen dates (today when none are chosen). */
export function useEmployeesOnLeave(startsOn: string | null, endsOn: string | null) { return useQuery({ queryKey: ["deployment-tracking", "on-leave", startsOn, endsOn] as const, queryFn: () => listEmployeeIdsOnLeave({ startsOn, endsOn }), staleTime: 60_000 }); }
export function useDeployment(id: string) { return useQuery({ queryKey: queryKeys.deploymentTracking.detail(id), queryFn: () => getDeployment(id), enabled: Boolean(id) }); }
function useInvalidate() { const client = useQueryClient(); return () => { void client.invalidateQueries({ queryKey: ["deployment-tracking"] }); void client.invalidateQueries({ queryKey: ["reporting"] }); void client.invalidateQueries({ queryKey: ["administration", "audit-logs"] }); }; }
export function useCreateDeploymentGroup() { const invalidate = useInvalidate(); return useMutation({ mutationFn: createDeploymentGroup, onSuccess: invalidate }); }
export function useUpdateDeployment() { const invalidate = useInvalidate(); return useMutation({ mutationFn: updateDeployment, onSuccess: invalidate }); }
export function useCancelDeployment() { const invalidate = useInvalidate(); return useMutation({ mutationFn: cancelDeployment, onSuccess: invalidate }); }
export function useProposeDeploymentStatus() { const invalidate = useInvalidate(); return useMutation({ mutationFn: proposeDeploymentStatus, onSuccess: invalidate }); }
export function useReviewDeploymentStatus() { const invalidate = useInvalidate(); return useMutation({ mutationFn: reviewDeploymentStatus, onSuccess: invalidate }); }
export function useDeploymentReports(deploymentId: string) { return useQuery({ queryKey: ["deployment-tracking", "reports", deploymentId] as const, queryFn: () => listDeploymentReports(deploymentId), enabled: Boolean(deploymentId) }); }
export function useSubmitDeploymentReport() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (input: DeploymentReportInput) => submitDeploymentReport(input), onSuccess: (_, input) => { void queryClient.invalidateQueries({ queryKey: ["deployment-tracking", "reports", input.deploymentId] }); } }); }
