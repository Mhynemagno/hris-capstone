"use client";

import { CircleCheck, CircleX, FileText } from "lucide-react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { formatDate, formatDateRange } from "@/lib/format-date";
import { openSignedUrl } from "@/lib/open-signed-url";
import type { PromotionEvaluationResult } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { getPersonnelDocumentUrl } from "@/queries/personnel-records";

type Row = { key: string; title: string; met: boolean; detail: string; document?: { path: string; name: string | null } | null };

const months = (value: number) => `${value} ${value === 1 ? "month" : "months"}`;

/** Turns the system evaluation into readable checklist rows (dates in words). */
export function promotionChecklistRows(evaluation: PromotionEvaluationResult): Row[] {
  const met = new Map(evaluation.requirements.map((requirement) => [requirement.key, requirement]));
  const rows: Row[] = [];
  const tig = met.get("time_in_grade");
  if (tig) {
    rows.push({
      key: "time_in_grade",
      title: tig.label,
      met: tig.met,
      detail: `Recorded: ${months(evaluation.timeInGradeMonths ?? 0)} in grade${evaluation.rankSince ? ` since ${formatDate(evaluation.rankSince)}` : ""}.`,
    });
  }
  for (const training of evaluation.trainings ?? []) {
    const record = training.record;
    rows.push({
      key: `training:${training.code}`,
      title: `Training: ${training.name}`,
      met: training.met,
      detail: record ? `${record.recordName}, completed ${formatDate(record.completedOn)}.` : "No completed record on file.",
      document: record?.documentPath ? { path: record.documentPath, name: record.documentName } : null,
    });
  }
  const eligibility = met.get("eligibility");
  if (eligibility) {
    const record = evaluation.eligibility?.record;
    rows.push({
      key: "eligibility",
      title: eligibility.label,
      met: eligibility.met,
      detail: record ? `${record.name}${record.rating ? ` — rating ${record.rating}` : " — rating not recorded"}, awarded ${formatDate(record.awardedOn)}.` : "No eligibility on file.",
      document: record?.documentPath ? { path: record.documentPath, name: record.documentName } : null,
    });
  }
  const iper = met.get("iper");
  if (iper) {
    const record = evaluation.iper?.record;
    rows.push({ key: "iper", title: iper.label, met: iper.met, detail: record ? `${record.rating} for ${formatDateRange(record.periodStartsOn, record.periodEndsOn)}.` : "No IPER recorded for the period." });
  }
  const pft = met.get("pft");
  if (pft) {
    const record = evaluation.pft?.record;
    const result = record?.result === "passed" ? "Passed" : record?.result === "failed" ? "Failed" : record ? `Score ${record.score ?? "—"}` : null;
    rows.push({ key: "pft", title: pft.label, met: pft.met, detail: record ? `${result} on ${formatDate(record.assessedOn)}.` : "No PFT result recorded for the period." });
  }
  return rows;
}

/** Met / missing requirements for the next rank, with links to the proof documents on file. */
export function PromotionChecklist({ evaluation, className }: { evaluation: PromotionEvaluationResult; className?: string }) {
  const rows = promotionChecklistRows(evaluation);
  return (
    <ul aria-label="Requirements checklist" className={cn("space-y-2", className)}>
      {rows.map((row) => {
        const Icon = row.met ? CircleCheck : CircleX;
        return (
          <li className={cn("flex items-start justify-between gap-3 rounded-xl border p-3 text-xs", row.met ? "border-emerald-200/80 bg-emerald-50/60" : "border-rose-200/80 bg-rose-50/60")} key={row.key}>
            <div className="flex min-w-0 items-start gap-2.5">
              <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", row.met ? "text-emerald-600" : "text-rose-600")} />
              <div className="min-w-0">
                <p className={cn("font-bold", row.met ? "text-emerald-950" : "text-rose-950")}>{row.title}</p>
                <p className={cn("text-[11px]", row.met ? "text-emerald-800" : "text-rose-800")}>{row.detail}</p>
                {row.document ? (
                  <button
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    onClick={() => void openSignedUrl(() => getPersonnelDocumentUrl(row.document!.path)).catch((cause) => notifyStaff({ title: "Unable to open the document", description: cause instanceof Error ? cause.message : undefined, tone: "error" }))}
                    type="button"
                  >
                    <FileText aria-hidden="true" className="size-3" />View proof{row.document.name ? `: ${row.document.name}` : ""}
                  </button>
                ) : null}
              </div>
            </div>
            <span className={cn("shrink-0 font-mono text-[10px] font-bold", row.met ? "text-emerald-700" : "text-rose-700")}>{row.met ? "MET" : "MISSING"}</span>
          </li>
        );
      })}
    </ul>
  );
}
