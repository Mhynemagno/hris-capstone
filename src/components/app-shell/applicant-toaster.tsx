"use client";

import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

const tones = {
  success: { Icon: CircleCheck, ring: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" },
  warning: { Icon: TriangleAlert, ring: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30" },
  error: { Icon: CircleX, ring: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30" },
} as const;

export type ApplicantNoticeTone = keyof typeof tones;

/** The applicant portal's notices: dark cards in the top-right corner (Capstone UI profile.html / documents.html toast). */
export function ApplicantToaster() {
  return <Sonner position="top-right" toastOptions={{ unstyled: true }} />;
}

export function notifyApplicant({ title, description, tone = "success" }: { title: string; description?: string; tone?: ApplicantNoticeTone }) {
  const { Icon, ring } = tones[tone];
  toast.custom(() => (
    <div className="capstone-ui flex w-80 items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900 px-4 py-3 text-white shadow-2xl" role={tone === "error" ? "alert" : "status"}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${ring}`}><Icon aria-hidden="true" className="size-4" /></span>
      <div className="min-w-0">
        <p className="text-xs font-bold">{title}</p>
        {description ? <p className="mt-0.5 text-[11px] text-slate-300">{description}</p> : null}
      </div>
    </div>
  ));
}
