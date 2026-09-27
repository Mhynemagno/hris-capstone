"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { getMyAccountEmail, listHrRegisteredApplicants, listMyApplicantEducation, removeMyApplicantProfileDocument, saveMyApplicantEducation } from "@/queries/applicant-portal";
import { listMyApplications } from "@/queries/recruitment";
import type { ApplicantEducationInput } from "@/schemas/applicant-portal";

export function useMyAccountEmail() {
  return useQuery({ queryKey: ["account", "email"], queryFn: getMyAccountEmail, staleTime: 5 * 60_000 });
}

export function useMyApplicantEducation() {
  return useQuery({ queryKey: queryKeys.recruitment.myEducation(), queryFn: listMyApplicantEducation });
}

export function useSaveMyApplicantEducation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicantId, education }: { applicantId: string; education: ApplicantEducationInput }) => saveMyApplicantEducation(applicantId, education),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.myEducation() }),
  });
}

export function useRemoveMyApplicantProfileDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeMyApplicantProfileDocument,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.profileDocuments() }),
  });
}

export function useHrRegisteredApplicants() {
  return useQuery({ queryKey: queryKeys.recruitment.registeredApplicants(), queryFn: listHrRegisteredApplicants });
}

const statusFilters = { page: 1, pageSize: 50 };

/** The applicant's applications, refreshed periodically so HR status changes show without a reload. */
export function useMyApplicationStatuses() {
  return useQuery({ queryKey: queryKeys.recruitment.myApplications(statusFilters), queryFn: () => listMyApplications(statusFilters), refetchInterval: 30_000, refetchOnWindowFocus: true });
}
