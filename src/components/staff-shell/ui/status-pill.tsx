import type { ReactNode } from "react";
import type { PillTone } from "@/lib/staff/status-maps";
import { cn } from "@/lib/utils";

const tones: Record<PillTone, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusPill({ tone, children, icon, className }: { tone: PillTone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase", tones[tone], className)}>
      {icon}{children}
    </span>
  );
}
