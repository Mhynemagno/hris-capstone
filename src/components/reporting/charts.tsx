import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ChartDatum = { label: string; count: number };

const numberFormat = new Intl.NumberFormat("en-PH");

export function formatCount(value: number) {
  return numberFormat.format(value);
}

function total(data: ChartDatum[]) {
  return data.reduce((sum, item) => sum + item.count, 0);
}

function percent(value: number, whole: number) {
  return whole ? Math.round((value / whole) * 100) : 0;
}

/** Plain-language summary read by screen readers in place of the drawn chart. */
function summarize(data: ChartDatum[], formatLabel: (label: string) => string) {
  if (!data.length) return "No records.";
  return data.map((item) => `${formatLabel(item.label)}: ${formatCount(item.count)}`).join(", ");
}

const identity = (label: string) => label;

/** Headline number tile. */
export function KpiTile({ label, value, hint, icon, tone = "default" }: { label: string; value: number; hint?: string; icon?: ReactNode; tone?: "default" | "attention" }) {
  return (
    <article aria-label={label} className="group relative flex min-h-32 flex-col justify-between gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "attention" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
            {icon}
          </span>
        ) : null}
      </div>
      <div>
        <p className="font-heading text-3xl font-semibold tracking-tight tabular-nums">{formatCount(value)}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </article>
  );
}

/** Card frame shared by every chart: title, optional subtitle, and a screen-reader table. */
export function ChartCard({ id, title, subtitle, children, className, data, formatLabel = identity, valueHeading = "Count", labelHeading = "Category" }: {
  id: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  data: ChartDatum[];
  formatLabel?: (label: string) => string;
  valueHeading?: string;
  labelHeading?: string;
}) {
  return (
    <section aria-labelledby={`chart-${id}`} className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div>
        <h2 className="font-heading text-lg font-semibold" id={`chart-${id}`}>{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {data.length && total(data) > 0 ? children : (
        <p className="grid min-h-40 flex-1 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">No records in this reporting period.</p>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">{labelHeading}</th><th scope="col">{valueHeading}</th></tr></thead>
        <tbody>{data.map((item) => <tr key={item.label}><td>{formatLabel(item.label)}</td><td>{item.count}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

/** Ranked magnitude comparison: one hue, direct value labels, bars anchored to a shared baseline. */
export function HorizontalBarChart({ data, formatLabel = identity, colorFor }: { data: ChartDatum[]; formatLabel?: (label: string) => string; colorFor?: (label: string) => string }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div aria-label={summarize(data, formatLabel)} role="img">
    <ul className="space-y-3">
      {data.map((item) => {
        const label = formatLabel(item.label);
        return (
          <li className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]" key={item.label} title={`${label}: ${formatCount(item.count)}`}>
            <span className="truncate text-sm text-foreground">{label}</span>
            <span className="h-3 rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-chart-1 transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(2, (item.count / max) * 100)}%`, ...(colorFor ? { backgroundColor: colorFor(item.label) } : null) }}
              />
            </span>
            <span className="min-w-8 text-right text-sm font-semibold tabular-nums">{formatCount(item.count)}</span>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

/** Part-to-whole for a few categories. Legend carries label, count and share, so color is never the only cue. */
export function DonutChart({ data, formatLabel = identity, colorFor, centerLabel = "Total" }: { data: ChartDatum[]; formatLabel?: (label: string) => string; colorFor: (label: string, index: number) => string; centerLabel?: string }) {
  const whole = total(data);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  // A 2px surface gap between segments (in path units, the ring is ~ 100 units wide).
  const gap = data.filter((item) => item.count > 0).length > 1 ? 1.2 : 0;
  const offsets = data.map((_, index) => data.slice(0, index).reduce((sum, item) => sum + (item.count / (whole || 1)) * circumference, 0));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-40 shrink-0">
        <svg aria-label={summarize(data, formatLabel)} className="size-full -rotate-90" role="img" viewBox="0 0 100 100">
          <circle className="stroke-muted" cx="50" cy="50" fill="none" r={radius} strokeWidth="12" />
          {data.map((item, index) => {
            if (!item.count) return null;
            const length = (item.count / whole) * circumference;
            const dash = Math.max(0.5, length - gap);
            return (
              <circle
                cx="50"
                cy="50"
                fill="none"
                key={item.label}
                r={radius}
                stroke={colorFor(item.label, index)}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offsets[index]!}
                strokeWidth="12"
              >
                <title>{`${formatLabel(item.label)}: ${formatCount(item.count)} (${percent(item.count, whole)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div aria-hidden className="absolute inset-0 grid place-content-center text-center">
          <span className="font-heading text-2xl font-semibold tabular-nums">{formatCount(whole)}</span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.map((item, index) => (
          <li className="flex items-center gap-3 text-sm" key={item.label}>
            <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: colorFor(item.label, index) }} />
            <span className="flex-1 text-foreground">{formatLabel(item.label)}</span>
            <span className="font-semibold tabular-nums">{formatCount(item.count)}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">{percent(item.count, whole)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Change over time: one column per day, labelled at the ends and the peak, tooltip on hover. */
export function ColumnTrendChart({ data, formatLabel = identity, unit = "records" }: { data: ChartDatum[]; formatLabel?: (label: string) => string; unit?: string }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  const peakIndex = data.reduce((best, item, index) => (item.count > (data[best]?.count ?? -1) ? index : best), 0);
  return (
    <div className="space-y-2">
      <div aria-label={`Daily ${unit}. ${summarize(data, formatLabel)}`} className="relative flex h-44 items-end gap-[2px] border-b border-border" role="img">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span aria-hidden className="absolute -top-0.5 right-0 -translate-y-full text-xs text-muted-foreground tabular-nums">{formatCount(max)}</span>
        {data.map((item, index) => (
          <div className="group relative flex h-full flex-1 items-end" key={item.label}>
            <div
              className={cn("w-full rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80", item.count === 0 && "bg-muted")}
              style={{ height: `${item.count ? Math.max(3, (item.count / max) * 100) : 2}%` }}
            />
            {index === peakIndex && item.count > 0 ? (
              <span aria-hidden className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold tabular-nums" style={{ bottom: `calc(${(item.count / max) * 100}% + 2px)` }}>{formatCount(item.count)}</span>
            ) : null}
            <span aria-hidden className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
              {formatLabel(item.label)}: <strong className="tabular-nums">{formatCount(item.count)}</strong>
            </span>
          </div>
        ))}
      </div>
      {data.length ? (
        <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
          <span>{formatLabel(data[0]!.label)}</span>
          <span>{formatLabel(data[data.length - 1]!.label)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Half-circle gauge for a single share, e.g. personnel present today out of active personnel. */
export function GaugeChart({ value, whole, label }: { value: number; whole: number; label: string }) {
  const share = whole > 0 ? Math.min(value / whole, 1) : 0;
  const shown = Math.round(share * 100);
  const arc = Math.PI * 80;
  return (
    <figure aria-label={`${label}: ${shown}% (${formatCount(value)} of ${formatCount(whole)})`} className="flex flex-col items-center" role="img">
      <div className="relative w-full max-w-60">
        <svg aria-hidden="true" className="w-full" viewBox="0 0 200 110">
          <path className="stroke-muted" d="M 20 100 A 80 80 0 0 1 180 100" fill="none" strokeLinecap="round" strokeWidth="18" />
          <path
            className="stroke-status-serious motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            strokeDasharray={arc}
            strokeDashoffset={arc * (1 - share)}
            strokeLinecap="round"
            strokeWidth="18"
          />
        </svg>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="font-heading text-3xl font-bold tabular-nums">{shown}%</span>
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground tabular-nums">{formatCount(value)} of {formatCount(whole)} active personnel</figcaption>
    </figure>
  );
}
