import Link from "next/link";
import type { ReactNode } from "react";

import { formatDate } from "@/lib/format-date";

export function DetailsPanel({ email, jobId, jobTitle, lastChange, mobile, number, submittedAt }: { email: string | null; mobile: string | null; number: string | null; jobId: number; jobTitle: string | null; submittedAt: string; lastChange: string | null }) {
  const rows: [string, ReactNode][] = [
    ["Email", email ?? "—"],
    ["Mobile", mobile ?? "—"],
    ["Applicant number", number ?? "—"],
    ["Job posting", jobTitle ? <Link className="text-primary hover:underline" href={`/hr/jobs/${jobId}`}>{jobTitle}</Link> : "—"],
    ["Submitted", formatDate(submittedAt)],
    ["Last stage change", formatDate(lastChange) ?? "—"],
  ];
  return (
    <aside aria-label="Applicant details" className="rounded-lg border bg-card p-5 lg:sticky lg:top-20">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-1">
        {rows.map(([label, value]) => (
          <div className="min-w-0" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="truncate text-base">{value}</dd></div>
        ))}
      </dl>
    </aside>
  );
}
