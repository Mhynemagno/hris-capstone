import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementBody } from "@/components/public-site/announcement-body";
import { PublicSiteHeader } from "@/components/recruitment/public-site-header";
import { formatDate } from "@/lib/format-date";
import { getPublishedAnnouncement } from "@/lib/public-site/published-announcement";
import { announcementCategoryLabel } from "@/schemas/public-site";

type AnnouncementPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: AnnouncementPageProps): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getPublishedAnnouncement(id);
  if (!announcement) return { title: "Announcement not found | San Juan City Police HRIS" };
  return { title: `${announcement.title} | San Juan City Police HRIS`, description: announcement.summary };
}

export default async function AnnouncementPage({ params }: AnnouncementPageProps) {
  const { id } = await params;
  const announcement = await getPublishedAnnouncement(id);
  if (!announcement) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <PublicSiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/#announcements">
          <ArrowLeft aria-hidden="true" className="size-4" />
          All announcements
        </Link>
        <article className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">{announcementCategoryLabel(announcement.category)}</span>
            {announcement.published_at ? <time dateTime={announcement.published_at}>{formatDate(announcement.published_at)}</time> : null}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{announcement.title}</h1>
          <p className="mt-3 text-lg leading-8 text-muted-foreground">{announcement.summary}</p>
          <AnnouncementBody body={announcement.body} className="mt-8" />
        </article>
      </main>
    </div>
  );
}
