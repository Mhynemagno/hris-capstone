import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Parses a `YYYY-MM-DD` date as a calendar day (UTC) so it never shifts across time zones. */
function parseDay(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfTodayUtc(today: Date) {
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

/** A calendar date shown as "Aug 16, 1982" (Philippine English), or null when missing. */
export function formatDay(value: string | null | undefined) {
  const date = parseDay(value);
  return date ? date.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
}

/** Length of service as "9 years 3 months", or null when the start date is missing. */
export function serviceLength(startedOn: string | null | undefined, endedOn?: string | null, today = new Date()) {
  const start = parseDay(startedOn);
  if (!start) return null;
  const end = parseDay(endedOn) ?? new Date(startOfTodayUtc(today));
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [years ? `${years} ${years === 1 ? "year" : "years"}` : "", rest ? `${rest} ${rest === 1 ? "month" : "months"}` : ""].filter(Boolean);
  return parts.length ? parts.join(" ") : "Less than a month";
}

/** A calendar date relative to today, e.g. "2 days ago", "last month", "in 3 years". */
export function relativeDay(value: string | null | undefined, today = new Date()) {
  const date = parseDay(value);
  if (!date) return null;
  const days = Math.round((date.getTime() - startOfTodayUtc(today)) / 86_400_000);
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(days) < 30) return format.format(days, "day");
  if (Math.abs(days) < 365) return format.format(Math.round(days / 30), "month");
  return format.format(Math.round(days / 365), "year");
}

export type ProfileMetaItem = { label: string; value: ReactNode; icon: LucideIcon };

type ProfileHeaderCardProps = {
  photo: ReactNode;
  name: string;
  subtitle: string;
  actions?: ReactNode;
  meta: ProfileMetaItem[];
  tags?: string[];
};

/** Top-of-profile summary: photo, name, rank, primary actions, key facts, and tag chips. */
export function ProfileHeaderCard({ photo, name, subtitle, actions, meta, tags = [] }: ProfileHeaderCardProps) {
  return (
    <section aria-label="Employee summary" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="bg-linear-to-br from-primary/10 via-primary/[0.03] to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            {photo}
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-3xl">{name}</h1>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{subtitle}</p>
              {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:max-w-2xl xl:shrink-0">
            {meta.map(({ label, value, icon: Icon }) => (
              <div className="min-w-0" key={label}>
                <dt className="flex items-center gap-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                  {label}
                </dt>
                <dd className="pl-6.5 font-semibold break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {tags.length ? (
          <ul aria-label="Highlights" className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-secondary-foreground" key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

type InfoCardProps = {
  icon: LucideIcon;
  title: string;
  id: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

/** A titled content card with an icon chip. */
export function InfoCard({ icon: Icon, title, id, children, className, action }: InfoCardProps) {
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4.5" /></span>
        <h2 className="font-heading text-lg font-semibold" id={id}>{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export type InfoRow = { label: string; value: ReactNode; icon: LucideIcon };

/** Label/value rows separated by hairlines, as in a contact card. */
export function InfoList({ rows }: { rows: InfoRow[] }) {
  return (
    <dl className="divide-y">
      {rows.map(({ label, value, icon: Icon }) => (
        <div className="min-w-0 py-3 first:pt-1 last:pb-0" key={label}>
          <dt className="flex items-center gap-3 text-xs text-muted-foreground">
            <Icon aria-hidden className="size-4 shrink-0" />
            {label}
          </dt>
          <dd className="pl-7 font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const tones = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
} as const;

export type TimelineItem = {
  id: string;
  icon: LucideIcon;
  tone: keyof typeof tones;
  category: string;
  title: string;
  detail?: string;
  date: string;
};

/** Vertical activity timeline, newest first, with relative dates. */
export function ActivityTimeline({ items, emptyMessage }: { items: TimelineItem[]; emptyMessage: string }) {
  if (!items.length) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[1.125rem] before:w-px before:bg-border">
      {items.map(({ id, icon: Icon, tone, category, title, detail, date }) => (
        <li className="relative flex gap-3" key={id}>
          <span aria-hidden className={cn("relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-card", tones[tone])}><Icon className="size-4" /></span>
          <div className="min-w-0 flex-1 rounded-xl border bg-background/60 px-3.5 py-3">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">{category}</p>
            <p className="font-semibold break-words">{title}</p>
            {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              <time dateTime={date} title={formatDay(date) ?? undefined}>{relativeDay(date) ?? date}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
