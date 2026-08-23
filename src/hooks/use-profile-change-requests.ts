"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { cancelProfileChangeRequest, decideProfileChangeRequest, getProfileChangeDocumentUrl, getProfileChangeRequest, listAdminProfileChangeRequests, listMyProfileChangeRequests, submitProfileChangeRequest } from "@/queries/profile-change-requests";
import { profileChangeRequestFiltersSchema, type ProfileChangeRequestFilters } from "@/schemas/profile-change-requests";

export function useMyProfileChangeRequests(input: Partial<ProfileChangeRequestFilters> = {}) { const filters = profileChangeRequestFiltersSchema.parse(input); return useQuery({ queryKey: queryKeys.profileChangeRequests.mine(filters), queryFn: () => listMyProfileChangeRequests(filters) }); }
export function useAdminProfileChangeRequests(input: Partial<ProfileChangeRequestFilters> = {}) { const filters = profileChangeRequestFiltersSchema.parse(input); return useQuery({ queryKey: queryKeys.profileChangeRequests.adminQueue(filters), queryFn: () => listAdminProfileChangeRequests(filters) }); }
export function useProfileChangeRequest(requestId: string) { return useQuery({ queryKey: queryKeys.profileChangeRequests.detail(requestId), queryFn: () => getProfileChangeRequest(requestId), enabled: Boolean(requestId) }); }
export function useProfileChangeDocumentUrl(objectPath: string) { return useQuery({ queryKey: queryKeys.profileChangeRequests.document(objectPath), queryFn: () => getProfileChangeDocumentUrl(objectPath), enabled: Boolean(objectPath), staleTime: 45_000 }); }
function useInvalidation() { const queryClient = useQueryClient(); return () => { void queryClient.invalidateQueries({ queryKey: ["profile-change-requests"] }); void queryClient.invalidateQueries({ queryKey: ["personnel-records"] }); void queryClient.invalidateQueries({ queryKey: ["notifications"] }); void queryClient.invalidateQueries({ queryKey: ["administration", "audit-logs"] }); }; }
export function useSubmitProfileChangeRequest() { const invalidate = useInvalidation(); return useMutation({ mutationFn: ({ draft, files }: { draft: { requestId: string; note?: string; changes: unknown[] }; files: File[] }) => submitProfileChangeRequest(draft, files), onSuccess: invalidate }); }
export function useCancelProfileChangeRequest() { const invalidate = useInvalidation(); return useMutation({ mutationFn: cancelProfileChangeRequest, onSuccess: invalidate }); }
export function useDecideProfileChangeRequest() { const invalidate = useInvalidation(); return useMutation({ mutationFn: decideProfileChangeRequest, onSuccess: invalidate }); }
