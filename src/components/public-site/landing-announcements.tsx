"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePublishedAnnouncements } from "@/hooks/use-public-site";
import { formatDate } from "@/lib/format-date";
import { announcementCategoryLabel } from "@/schemas/public-site";

import { SectionIntro } from "./section-intro";

export function LandingAnnouncements() {
  const announcements = usePublishedAnnouncements(6);
  const rows = announcements.data ?? [];
  return (
    <section aria-labelledby="announcements-heading" className="scroll-mt-24 border-t border-border/80" id="announcements">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro description="News and advisories from the San Juan City Police Station." eyebrow="Station news" id="announcements-heading" title="Announcements" />
        <div className="mt-8">
          {announcements.isLoading ? (
            <LoadingState label="Loading announcements…" />
          ) : announcements.error ? (
            <ErrorState message="Announcements could not be loaded. Please try again later." />
          ) : rows.length === 0 ? (
            <p className="glass-panel rounded-2xl border border-border p-6 text-base text-slate-300" role="status">No announcements right now.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((announcement) => (
                <li key={announcement.id}>
                  <article aria-labelledby={`announcement-${announcement.id}-title`} className="glass-panel flex h-full flex-col rounded-2xl border border-border p-6 motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                      <span className="rounded-full border border-cta/30 bg-cta/10 px-2.5 py-0.5 font-semibold text-cta">{announcementCategoryLabel(announcement.category)}</span>
                      {announcement.published_at ? <time dateTime={announcement.published_at}>{formatDate(announcement.published_at)}</time> : null}
                    </p>
                    <h3 className="mt-3 text-lg font-bold text-white [overflow-wrap:anywhere]" id={`announcement-${announcement.id}-title`}>{announcement.title}</h3>
                    <p className="mt-2 flex-1 text-base leading-7 text-slate-300 [overflow-wrap:anywhere]">{announcement.summary}</p>
                    <Link
                      aria-label={`Read more about ${announcement.title}`}
                      className="mt-4 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg font-semibold text-cta underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      href={`/announcements/${announcement.id}`}
                    >
                      Read more
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
