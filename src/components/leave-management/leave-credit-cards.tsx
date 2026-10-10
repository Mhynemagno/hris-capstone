import { Baby, Briefcase, CalendarDays, HeartPulse, Star, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { LeaveBalance, LeaveType } from "@/lib/types/database";

type CardType = Pick<LeaveType, "id" | "name" | "description" | "days_per_year">;

/** A recognisable icon per standard leave type; anything else gets the calendar. */
function iconFor(name: string): LucideIcon {
  const lower = name.toLowerCase();
  if (lower.includes("sick")) return HeartPulse;
  if (lower.includes("vacation")) return Briefcase;
  if (lower.includes("special privilege")) return Star;
  if (lower.includes("maternity") || lower.includes("paternity")) return Baby;
  return CalendarDays;
}

const dayCount = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/**
 * The leave types as cards (client round 5): yearly days, the type's note, and — when balances are given —
 * how many days are left this year. `action` adds a control per card, such as HR's Update button.
 */
export function LeaveCreditCards({ types, balances, year, action }: { types: CardType[]; balances?: LeaveBalance[]; year?: number; action?: (type: CardType) => ReactNode }) {
  if (!types.length) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No leave types are set up.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {types.map((type) => {
        const Icon = iconFor(type.name);
        const balance = balances?.find((entry) => entry.leave_type_id === type.id);
        const remaining = balance && type.days_per_year !== null ? Math.max(type.days_per_year - balance.used_days, 0) : type.days_per_year;
        const headingId = `leave-card-${type.id}`;
        return (
          <li key={type.id}>
            <article aria-labelledby={headingId} className="flex h-full flex-col rounded-2xl border bg-card p-5 text-center shadow-sm">
              <span aria-hidden className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <h3 className="mt-3 font-heading text-lg font-bold tracking-wide uppercase" id={headingId}>{type.name}</h3>
              <p className="mt-2 text-2xl font-bold text-primary tabular-nums">{type.days_per_year === null ? "No yearly limit" : `${type.days_per_year} Days / Year`}</p>
              {balances && year && remaining !== null ? <p className="mt-1 text-sm font-medium text-muted-foreground tabular-nums">{dayCount(remaining)} left in {year}</p> : null}
              {type.description ? (
                <p className="mt-4 rounded-lg border-l-4 border-primary bg-muted/60 px-3 py-2 text-left text-sm"><span className="font-semibold">NOTE:</span> {type.description}</p>
              ) : null}
              {action ? <div className="mt-auto pt-4">{action(type)}</div> : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
