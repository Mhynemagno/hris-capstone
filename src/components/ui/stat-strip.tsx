import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Filled icon tiles for dashboard stats (client reference, round 5). */
const TONES = {
  blue: "from-blue-500 to-blue-600",
  violet: "from-violet-500 to-violet-600",
  orange: "from-orange-500 to-orange-600",
  emerald: "from-emerald-500 to-emerald-600",
  rose: "from-rose-500 to-rose-600",
} as const;

export type StatTone = keyof typeof TONES;
type Stat = { key: string; label: string; value: ReactNode; hint?: ReactNode; href?: string; icon?: LucideIcon; tone?: StatTone };

export function StatStrip({ items, label }: { label: string; items: Stat[] }) {
  const withIcons = items.some((item) => item.icon);
  return (
    <section
      aria-label={label}
      className={withIcons
        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        : "grid divide-y overflow-hidden rounded-lg border bg-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x"}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const body = (
          <article aria-label={item.label} className={cn("flex h-full gap-4 px-5 py-4", Icon ? "items-center" : "flex-col gap-1")}>
            {Icon ? (
              <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm", TONES[item.tone ?? "blue"])} data-testid="stat-icon">
                <Icon className="size-6" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-3xl font-semibold tabular-nums" data-numeric>{item.value}</p>
              {item.hint ? <p className="text-sm text-muted-foreground">{item.hint}</p> : null}
            </div>
          </article>
        );
        const cardClassName = withIcons ? "rounded-xl border bg-card shadow-sm" : undefined;
        return item.href
          ? <Link className={cn("transition-colors hover:bg-muted focus-visible:outline-offset-[-3px]", cardClassName)} href={item.href} key={item.key}>{body}</Link>
          : <div className={cardClassName} key={item.key}>{body}</div>;
      })}
    </section>
  );
}
