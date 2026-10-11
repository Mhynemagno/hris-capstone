import { ArrowRight } from "lucide-react";
import Link from "next/link";

const percent = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

const ROWS = [
  { key: "present", label: "Present", tint: "bg-emerald-50/60 border-emerald-100", dot: "bg-emerald-500", title: "text-emerald-900", value: "text-emerald-800", pct: "text-emerald-700" },
  { key: "absent", label: "Absent / Leave", tint: "bg-amber-50/60 border-amber-100", dot: "bg-amber-500", title: "text-amber-900", value: "text-amber-800", pct: "text-amber-700" },
  { key: "partial", label: "Partial / Late", tint: "bg-rose-50/60 border-rose-100", dot: "bg-rose-500", title: "text-rose-900", value: "text-rose-800", pct: "text-rose-700" },
] as const;

/** Capstone UI dashboard.html "Daily Attendance Overview": a CSS doughnut and the three status rows. */
export function AttendanceDoughnut({ present, absent, partial, total }: { present: number; absent: number; partial: number; total: number }) {
  const presentShare = percent(present, total);
  const absentShare = percent(absent, total);
  const counts = { present, absent, partial };
  return (
    <section aria-labelledby="attendance-heading" className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900" id="attendance-heading">Daily Attendance Overview</h2>
          <p className="text-xs text-slate-500">Real-time DTR &amp; Attendance Status</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-emerald-700 uppercase">Live Log</span>
      </div>

      <div className="relative flex items-center justify-center py-2">
        <div
          aria-hidden="true"
          className="relative size-44 rounded-full"
          style={{ background: total ? `conic-gradient(#10b981 0 ${presentShare}%, #f59e0b ${presentShare}% ${presentShare + absentShare}%, #f43f5e ${presentShare + absentShare}% 100%)` : "#e2e8f0" }}
        >
          <div className="absolute inset-[14%] flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-2xl font-black text-slate-900">{total}</span>
            <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">Total Active</span>
          </div>
        </div>
      </div>

      <ul className="space-y-2.5 text-xs">
        {ROWS.map((row) => (
          <li className={`flex items-center justify-between rounded-xl border p-2.5 ${row.tint}`} key={row.key}>
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className={`size-3 rounded-full ${row.dot}`} />
              <span className={`font-bold ${row.title}`}>{row.label}</span>
            </span>
            <span className={`font-mono font-black ${row.value}`}>
              {counts[row.key]} <span className={`text-[10px] font-normal ${row.pct}`}>({percent(counts[row.key], total).toFixed(1)}%)</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="pt-2">
        <Link className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-100 py-2.5 text-center text-xs font-bold text-blue-700 transition-all hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" href="/hr/attendance">
          <span>Go to Full Attendance Roster</span>
          <ArrowRight aria-hidden="true" className="size-2.5" />
        </Link>
      </div>
    </section>
  );
}
