"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type Pager = { page: number; pageSize: number; total: number; noun: string; onPageChange: (page: number) => void };

const pagerButton = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

export function StaffTableCard({ title, subtitle, count, toolbar, children, pager }: { title: string; subtitle?: string; count?: string; toolbar?: ReactNode; children: ReactNode; pager?: Pager }) {
  const pageCount = pager ? Math.max(1, Math.ceil(pager.total / pager.pageSize)) : 1;
  const from = pager && pager.total ? (pager.page - 1) * pager.pageSize + 1 : 0;
  const to = pager ? Math.min(pager.total, pager.page * pager.pageSize) : 0;
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            {count ? <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700">{count}</span> : null}
          </div>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {toolbar ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{toolbar}</div> : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
      {pager ? (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500">
          <p>{pager.total ? `Showing ${from}–${to} of ${pager.total} ${pager.noun}` : `Showing 0 of 0 ${pager.noun}`}</p>
          <div className="flex gap-2">
            <button className={pagerButton} disabled={pager.page <= 1} onClick={() => pager.onPageChange(pager.page - 1)} type="button"><ChevronLeft aria-hidden="true" className="size-3" /> Previous</button>
            <button className={pagerButton} disabled={pager.page >= pageCount} onClick={() => pager.onPageChange(pager.page + 1)} type="button">Next <ChevronRight aria-hidden="true" className="size-3" /></button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The mockup table classes, shared by every staff list. */
export const staffTable = {
  table: "w-full min-w-[760px] text-left text-xs",
  thead: "bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase",
  th: "px-4 py-3.5 first:pl-6 last:pr-6",
  tbody: "divide-y divide-slate-100 font-medium text-slate-700",
  tr: "transition-colors hover:bg-slate-50/80",
  td: "px-4 py-4 first:pl-6 last:pr-6",
} as const;
