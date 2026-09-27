"use client";

import Link from "next/link";
import { Eye, UserRound } from "lucide-react";
import { useState } from "react";

import { statusStyles } from "@/components/recruitment/hr-application-list";
import { buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import type { HrRegisteredApplicant } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

function formatApplicantNumber(value: number | null) {
  if (value === null) return null;
  const digits = String(value).padStart(6, "0");
  return `${digits.slice(0, 1)}-${digits.slice(1)}`;
}

export function applicantDisplayName(applicant: HrRegisteredApplicant) {
  const name = [applicant.last_name, [applicant.first_name, applicant.middle_name, applicant.qualifier].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return name || applicant.full_name || applicant.email || "Applicant";
}

export function HrRegisteredApplicantList() {
  const applicants = useHrRegisteredApplicants();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const rows = (applicants.data ?? []).filter((applicant) => !term || [applicantDisplayName(applicant), applicant.email, applicant.phone].some((value) => value?.toLowerCase().includes(term)));

  return (
    <section aria-label="Registered applicants" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p aria-live="polite" className="text-sm text-muted-foreground">{applicants.isLoading ? "Loading…" : rows.length === 1 ? "1 applicant" : `${rows.length} applicants`}</p>
        <Input aria-label="Search applicants" className="max-w-xs" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or mobile" type="search" value={search} />
      </div>
      {applicants.isLoading ? <div className="p-4"><LoadingState label="Loading applicants…" /></div> : applicants.error ? <div className="p-4"><ErrorState message={applicants.error.message} /></div> : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Registered applicant accounts</caption>
            <thead className="border-b bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold" scope="col">Applicant</th>
                <th className="px-4 py-3 font-semibold" scope="col">Email</th>
                <th className="px-4 py-3 font-semibold" scope="col">Mobile</th>
                <th className="px-4 py-3 font-semibold" scope="col">Registered</th>
                <th className="px-4 py-3 font-semibold" scope="col">Application</th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length ? rows.map((applicant) => {
                const name = applicantDisplayName(applicant);
                const number = formatApplicantNumber(applicant.applicant_number);
                const status = applicant.latest_application_status;
                return (
                  <tr className="transition-colors hover:bg-muted/40" key={applicant.user_id}>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-5" /></span>
                        <div className="min-w-0"><p className="font-semibold">{name}</p>{number ? <p className="text-xs text-muted-foreground tabular-nums">Applicant no. {number}</p> : null}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle break-all">{applicant.email ?? "—"}{applicant.email_confirmed ? null : <p className="text-xs text-muted-foreground">Email not confirmed</p>}</td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap tabular-nums">{applicant.phone ?? "—"}</td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap tabular-nums">{dateFormat.format(new Date(applicant.registered_at))}</td>
                    <td className="px-4 py-3 align-middle">
                      {status ? <div className="space-y-1">
                        <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", statusStyles[status] ?? statusStyles["Not Selected"])}>{status}</span>
                        <p className="text-xs text-muted-foreground">{applicant.latest_job_title}{applicant.application_count > 1 ? ` · ${applicant.application_count} applications` : ""}</p>
                      </div> : <span className="text-muted-foreground">No application yet</span>}
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      {applicant.latest_application_id ? <Link className={buttonVariants({ className: "min-h-10", size: "sm", variant: "outline" })} href={`/hr/applications/${applicant.latest_application_id}`}><Eye aria-hidden="true" />Review{" "}<span className="sr-only">latest application of {name}</span></Link> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td className="px-4 py-12 text-center text-muted-foreground" colSpan={6}>{term ? "No applicants match this search." : "No applicant accounts have been registered yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
