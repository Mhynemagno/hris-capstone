"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  getApplicantProfile,
  getApplicantProfilePhotoUrl,
  deleteDraftJobOpening,
  getApplicationAiScores,
  getMyApplication,
  getMyApplicationForJob,
  getPublishedJob,
  hireApplication,
  listHrApplications,
  listHrJobs,
  listApplicantProfileDocuments,
  listMyApplications,
  listPublishedJobs,
  saveApplicantProfile,
  saveApplicantProfileDocuments,
  replaceMyApplicantProfilePhoto,
  removeMyApplicantProfilePhoto,
  retryApplicationAnalysis,
  resubmitApplication,
  saveJobOpening,
  submitApplication,
  transitionApplicationStatus,
  withdrawJobOpening,
} from "@/queries/recruitment";
import type {
  ApplicantProfileDocumentFile,
  ApplicantProfileInput,
  ApplicationAiFilters,
  ApplicationFilters,
  ApplicationStatusTransitionInput,
  HiringDecisionInput,
  JobFilters,
  JobOpeningInput,
} from "@/schemas/recruitment";
import type { ResubmitApplicationInput } from "@/queries/recruitment";

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

export function useApplicantProfilePhotoUrl(objectPath: string | null) {
  return useQuery({ queryKey: queryKeys.recruitment.profilePhoto(objectPath), queryFn: () => getApplicantProfilePhotoUrl(objectPath), enabled: Boolean(objectPath) });
}

export function useReplaceMyApplicantProfilePhoto(applicant: { id: string; profile_image_path: string | null }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => replaceMyApplicantProfilePhoto(applicant, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.myProfile() });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "profile-photo"] });
    },
  });
}

export function useRemoveMyApplicantProfilePhoto(applicant: { id: string; profile_image_path: string | null }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeMyApplicantProfilePhoto(applicant),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.myProfile() });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "profile-photo"] });
    },
  });
}

export function useApplicantProfileDocuments() {
  return useQuery({ queryKey: queryKeys.recruitment.profileDocuments(), queryFn: listApplicantProfileDocuments });
}

export function useSaveApplicantProfileDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documents: Array<{ kind: "eligibility" | "diploma"; file: ApplicantProfileDocumentFile }>) => saveApplicantProfileDocuments(documents),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.profileDocuments() }),
  });
}

export function useMyApplications(filters: Partial<ApplicationFilters> = {}) {
  return useQuery({ queryKey: queryKeys.recruitment.myApplications(filters), queryFn: () => listMyApplications(filters) });
}

export function useMyApplication(applicationId: string) {
  return useQuery({ queryKey: queryKeys.recruitment.application(applicationId), queryFn: () => getMyApplication(applicationId), enabled: Boolean(applicationId) });
}

export function useMyApplicationForJob(jobId: number) {
  return useQuery({ queryKey: queryKeys.recruitment.applicationForJob(jobId), queryFn: () => getMyApplicationForJob(jobId), enabled: Number.isInteger(jobId) && jobId > 0 });
}

export function useSubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitApplication,
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "my-applications"] });
      void queryClient.invalidateQueries({ queryKey: ["reporting"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(input.applicationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.job(input.jobId) });
    },
  });
}

export function useResubmitApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResubmitApplicationInput) => resubmitApplication(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "my-applications"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(input.applicationId) });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "application-for-job"] });
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
      void queryClient.invalidateQueries({ queryKey: ["reporting"] });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "public-jobs"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.job(job.id) });
    },
  });
}

export function useDeleteDraftJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDraftJobOpening,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "hr-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "public-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["reporting"] });
    },
  });
}

export function useWithdrawJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withdrawJobOpening,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "hr-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "public-jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["reporting"] });
    },
  });
}

export function useHrApplications(filters: Partial<ApplicationAiFilters> = {}) {
  return useQuery({ queryKey: queryKeys.recruitment.applications(filters), queryFn: () => listHrApplications(filters) });
}

export function useApplicationAiScores(applicationId: string) {
  return useQuery({ queryKey: queryKeys.recruitment.aiScores(applicationId), queryFn: () => getApplicationAiScores(applicationId), enabled: Boolean(applicationId) });
}

export function useRetryApplicationAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: retryApplicationAnalysis, onSuccess: (_, applicationId) => {
    void queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
    void queryClient.invalidateQueries({ queryKey: ["reporting"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.application(applicationId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recruitment.aiScores(applicationId) });
  } });
}

export function useTransitionApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationStatusTransitionInput) => transitionApplicationStatus(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: ["recruitment", "applications"] });
      void queryClient.invalidateQueries({ queryKey: ["reporting"] });
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
      void queryClient.invalidateQueries({ queryKey: ["reporting"] });
      void queryClient.invalidateQueries({ queryKey: ["personnel-records", "directory"] });
      void queryClient.invalidateQueries({ queryKey: ["administration", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["administration", "audit-logs"] });
    },
  });
}
