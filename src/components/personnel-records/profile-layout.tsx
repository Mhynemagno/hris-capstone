import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { formatDate } from "@/lib/format-date";
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

/** A calendar date shown in words as "August 16, 1982", or null when missing or invalid. */
export function formatDay(value: string | null | undefined) {
  return value && parseDay(value) ? formatDate(value.slice(0, 10)) : null;
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
  photo?: ReactNode;
  name: string;
  subtitle: string;
  actions?: ReactNode;
  meta: ProfileMetaItem[];
  tags?: string[];
  /** Status chips shown under the rank. */
  pills?: ReactNode;
  /** The name is the page heading (h1) unless the page already has its own title. */
  headingLevel?: 1 | 2;
};

/** Capstone personnel card: photo, name, rank, status, primary actions and key facts. The facts sit below the name so the name always keeps the full width. */
export function ProfileHeaderCard({ photo, name, subtitle, actions, meta, tags = [], pills, headingLevel = 1 }: ProfileHeaderCardProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section aria-label="Employee summary" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          {photo ? <div className="shrink-0">{photo}</div> : null}
          <div className="min-w-0">
            <Heading className="text-2xl font-extrabold tracking-tight break-words text-slate-900">{name}</Heading>
            <p className="mt-0.5 text-xs font-bold text-slate-500">{subtitle}</p>
            {pills ? <div className="mt-3 flex flex-wrap gap-2">{pills}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-100 pt-6 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {meta.map(({ label, value, icon: Icon }) => (
          <div className="min-w-0" key={label}>
            <dt className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              <Icon aria-hidden className="size-3.5 shrink-0 text-blue-900" />
              {label}
            </dt>
            <dd className="mt-0.5 text-xs font-bold break-words text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
      {tags.length ? (
        <ul aria-label="Highlights" className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700" key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
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

/** A titled Capstone content card with an icon chip. */
export function InfoCard({ icon: Icon, title, id, children, className, action }: InfoCardProps) {
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", className)}>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-900"><Icon className="size-4" /></span>
        <h2 className="text-sm font-bold text-slate-900" id={id}>{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type InfoRow = { label: string; value: ReactNode; icon: LucideIcon };

/** Label/value rows separated by hairlines, as in a contact card. */
export function InfoList({ rows }: { rows: InfoRow[] }) {
  return (
    <dl className="divide-y">
      {rows.map(({ label, value, icon: Icon }) => (
        <div className="min-w-0 py-3 first:pt-0 last:pb-0" key={label}>
          <dt className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            <Icon aria-hidden className="size-3.5 shrink-0" />
            {label}
          </dt>
          <dd className="pl-5.5 text-xs font-bold break-words text-slate-800">{value}</dd>
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
