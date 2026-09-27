"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedJob } from "@/hooks/use-recruitment";
import { formatDeadline } from "@/lib/recruitment/format-deadline";
import { jobPostingImageUrl } from "@/lib/recruitment/job-posting-image";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import { ApplyPrivacyNotice } from "./apply-privacy-notice";

export function PublicJobDetail({ jobId }: { jobId: number }) {
  const job = usePublishedJob(jobId);
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    void createBrowserSupabaseClient().auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
  }, []);
  if (job.isLoading) return <LoadingState label="Loading job opening…" />;
  if (job.error) return <ErrorState message={job.error.message} />;
  if (!job.data) return <ErrorState message="This job opening is unavailable or has closed." />;
  const criteria = [...(job.data.job_qualification_criteria ?? [])].sort((left, right) => left.ordinal - right.ordinal);
  const applyPath = `/applicant/applications?jobId=${job.data.id}`;
  const imageUrl = jobPostingImageUrl(job.data.image_path);
  return <section className="mx-auto max-w-4xl space-y-6">
    <div><Link className="text-sm text-primary underline-offset-4 hover:underline" href="/jobs">All job openings</Link><h1 className="mt-4 text-3xl font-semibold tracking-tight">{job.data.title}</h1><p className="mt-2 text-sm text-muted-foreground">{[job.data.location, job.data.closes_on ? `Deadline of Application: ${formatDeadline(job.data.closes_on)}` : null].filter(Boolean).join(" · ")}</p></div>
    {imageUrl ? <Image alt={`${job.data.title} job posting`} className="h-auto w-full rounded-xl border object-contain" height={900} priority src={imageUrl} unoptimized width={1600} /> : null}
    <p className="whitespace-pre-wrap leading-7">{job.data.description}</p>
    {criteria.length ? <div className="rounded-xl border p-5"><h2 className="font-semibold">Qualifications</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{criteria.map((criterion) => <li key={criterion.id}><span className="font-medium">{criterion.is_required ? "Required" : "Preferred"}:</span> {criterion.requirement}</li>)}</ul></div> : null}
    <ApplyPrivacyNotice className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={isSignedIn ? applyPath : `/login?next=${encodeURIComponent(applyPath)}`}>Apply now<ArrowRight aria-hidden="true" className="size-4" /></ApplyPrivacyNotice>
  </section>;
}
