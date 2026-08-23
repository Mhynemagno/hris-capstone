"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrJobs } from "@/hooks/use-recruitment";
import { HrJobForm } from "./hr-job-form";

export function HrJobEditor({ jobId }: { jobId: number }) {
  const jobs = useHrJobs({ page: 1, pageSize: 100 });
  if (jobs.isLoading) return <LoadingState label="Loading job opening…" />;
  if (jobs.error) return <ErrorState message={jobs.error.message} />;
  const job = jobs.data?.rows.find((row) => row.id === jobId);
  if (!job) return <ErrorState message="This job opening is unavailable." />;
  return <HrJobForm job={job} />;
}
