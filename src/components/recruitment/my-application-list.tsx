"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyApplications } from "@/hooks/use-recruitment";

export function MyApplicationList() {
  const applications = useMyApplications({ page: 1, pageSize: 50 });
  if (applications.isLoading) return <LoadingState label="Loading applications…" />;
  if (applications.error) return <ErrorState message={applications.error.message} />;
  const rows = applications.data?.rows ?? [];
  if (!rows.length) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">You have not submitted any applications yet.</p>;
  return <div className="space-y-3">{rows.map((application) => {
    const opening = (application as typeof application & { job_openings?: { title?: string; location?: string } | null }).job_openings;
    return <Link className="block rounded-xl border p-4 hover:bg-muted" href={`/applicant/applications/${application.id}`} key={application.id}><p className="font-medium">{opening?.title ?? `Application ${application.id.slice(0, 8)}`}</p><p className="mt-1 text-sm text-muted-foreground">{opening?.location ? `${opening.location} · ` : ""}Status: {application.status}</p></Link>;
  })}</div>;
}
