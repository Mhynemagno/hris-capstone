"use client";

import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { useBreadcrumbTrail } from "@/components/workspace-shell/breadcrumbs";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useHrJob } from "@/hooks/use-recruitment";

import { HrJobForm } from "./hr-job-form";

export function HrJobEditor({ jobId }: { jobId: number }) {
  const job = useHrJob(jobId);
  useBreadcrumbTrail([{ label: job.data?.title ?? "Edit job posting" }]);
  return (
    <PageContainer width="wide">
      {job.isLoading ? <LoadingState label="Loading job posting…" /> : job.error ? <ErrorState message={job.error.message} onRetry={() => void job.refetch()} /> : !job.data ? (
        <>
          <PageHeader title="Job posting not found" />
          <EmptyState action={<Link className="font-medium text-primary hover:underline" href="/hr/jobs">Back to job postings</Link>} title="This job posting does not exist or was deleted." />
        </>
      ) : (
        <>
          <PageHeader description={job.data.location ?? undefined} title={job.data.title} />
          <HrJobForm job={job.data} />
        </>
      )}
    </PageContainer>
  );
}
