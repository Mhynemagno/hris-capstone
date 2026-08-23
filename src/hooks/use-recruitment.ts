"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getApplicantProfile,
  getApplicationAiScores,
  getMyApplication,
  getPublishedJob,
  hireApplication,
  listHrApplications,
  listHrJobs,
  listMyApplications,
  listPublishedJobs,
  saveApplicantProfile,
  requestApplicationAnalysis,
  saveJobOpening,
  submitApplication,
  transitionApplicationStatus,
} from "@/queries/recruitment";
import type {
  ApplicantProfileInput,
  ApplicationAnalysisRequestInput,
  ApplicationFilters,
  ApplicationStatusTransitionInput,
  HiringDecisionInput,
  JobFilters,
  JobOpeningInput,
} from "@/schemas/recruitment";

export function usePublishedJobs(filters: Partial<JobFilters> = {}) {
  return useQuery({ queryKey: queryKeys.recruitment.publicJobs(filters), queryFn: () => listPublishedJobs(filters) });
}

export function usePublishedJob(jobId: number) {
  return useQuery({ queryKey: queryKeys.recruitment.job(jobId), queryFn: () => getPublishedJob(jobId), enabled: Number.isInteger(jobId) && jobId > 0 });
}

export function useApplicantProfile() {
  return useQuery({ queryKey: queryKeys.recruitment.myProfile(), queryFn: getApplicantProfile });
}

export function useSaveApplicantProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicantProfileInput) => saveApplicantProfile(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.myProfile() }),
  });
}

export function useMyApplications(filters: Partial<ApplicationFilters> = {}) {
  return useQuery({ queryKey: queryKeys.recruitment.myApplications(filters), queryFn: () => listMyApplications(filters) });
}

export function useMyApplication(applicationId: string) {
  return useQuery({ queryKey: queryKeys.recruitment.application(applicationId), queryFn: () => getMyApplication(applicationId), enabled: Boolean(applicationId) });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitApplication,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "my-applications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(input.applicationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.job(input.jobId) });
    },
  });
}

export function useHrJobs(filters: Partial<JobFilters> = {}) {
  return useQuery({ queryKey: queryKeys.recruitment.hrJobs(filters), queryFn: () => listHrJobs(filters) });
}

export function useSaveJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, jobId }: { input: JobOpeningInput; jobId?: number }) => saveJobOpening(input, jobId),
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "hr-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "public-jobs"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.job(job.id) });
    },
  });
}

export function useHrApplications(filters: Partial<ApplicationFilters> = {}) {
  return useQuery({ queryKey: queryKeys.recruitment.applications(filters), queryFn: () => listHrApplications(filters) });
}

export function useApplicationAiScores(applicationId: string) {
  return useQuery({ queryKey: queryKeys.recruitment.aiScores(applicationId), queryFn: () => getApplicationAiScores(applicationId), enabled: Boolean(applicationId) });
}

export function useRequestApplicationAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: ApplicationAnalysisRequestInput) => requestApplicationAnalysis(input), onSuccess: (_, input) => {
    void queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(input.applicationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.aiScores(input.applicationId) });
  } });
}

export function useTransitionApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationStatusTransitionInput) => transitionApplicationStatus(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(input.applicationId) });
    },
  });
}

export function useHireApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: HiringDecisionInput) => hireApplication(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment"] });
      void queryClient.invalidateQueries({ queryKey: ["personnel-records", "directory"] });
      void queryClient.invalidateQueries({ queryKey: ["administration", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["administration", "audit-logs"] });
    },
  });
}
