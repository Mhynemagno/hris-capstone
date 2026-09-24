"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { createDeployment, deploymentFilters, getDeployment, listEmployeeOptions, listHrDeployments, listMyDeployments, updateDeployment } from "@/queries/deployment-tracking";
import type { DeploymentFilters } from "@/schemas/deployment-tracking";

export function useHrDeployments(input: Partial<DeploymentFilters> = {}) { const filters = deploymentFilters(input); return useQuery({ queryKey: queryKeys.deploymentTracking.hrDirectory(filters), queryFn: () => listHrDeployments(filters) }); }
export function useMyDeployments(input: Partial<DeploymentFilters> = {}) { const filters = deploymentFilters(input); return useQuery({ queryKey: queryKeys.deploymentTracking.mine(filters), queryFn: () => listMyDeployments(filters) }); }
/** All employees (capped at 2000) for the deployment employee picker. */
export function useEmployeeOptions() { return useQuery({ queryKey: ["deployment-tracking", "employee-options"], queryFn: listEmployeeOptions, staleTime: 60_000 }); }
export function useDeployment(id: string) { return useQuery({ queryKey: queryKeys.deploymentTracking.detail(id), queryFn: () => getDeployment(id), enabled: Boolean(id) }); }
function useInvalidate() { const client = useQueryClient(); return () => { void client.invalidateQueries({ queryKey: ["deployment-tracking"] }); void client.invalidateQueries({ queryKey: ["reporting"] }); void client.invalidateQueries({ queryKey: ["administration", "audit-logs"] }); }; }
export function useCreateDeployment() { const invalidate = useInvalidate(); return useMutation({ mutationFn: createDeployment, onSuccess: invalidate }); }
export function useUpdateDeployment() { const invalidate = useInvalidate(); return useMutation({ mutationFn: updateDeployment, onSuccess: invalidate }); }
