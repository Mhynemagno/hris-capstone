"use client";

import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrApplications } from "@/hooks/use-recruitment";

export function HrApplicationList() {
  const applications = useHrApplications({ page: 1, pageSize: 100 });
  if (applications.isLoading) return <LoadingState label="Loading applications…" />;
  if (applications.error) return <ErrorState message={applications.error.message} />;
  const rows = applications.data?.rows ?? [];
  if (!rows.length) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">There are no applications to review.</p>;
  return <div className="space-y-3">{rows.map((application) => <Link className="block rounded-xl border p-4 hover:bg-muted" href={`/hr/applications/${application.id}`} key={application.id}><div className="flex items-center justify-between gap-3"><span className="font-medium">Application {application.id.slice(0, 8)}</span><span className="rounded-full bg-muted px-2 py-1 text-xs">{application.status}</span></div><p className="mt-1 text-sm text-muted-foreground">Submitted {new Date(application.submitted_at).toLocaleDateString()}</p></Link>)}</div>;
}
