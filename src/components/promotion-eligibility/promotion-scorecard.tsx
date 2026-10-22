"use client";

import { FilePlus2 } from "lucide-react";

import { formatDate } from "@/lib/format-date";
import type { PromotionEvaluationResult } from "@/lib/types/database";
import { cn } from "@/lib/utils";

import type { PromotionEvidenceCriterion } from "./promotion-score-evidence-dialog";

type Criterion = NonNullable<PromotionEvaluationResult["criteria"]>[number];

const scoreFormat = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

/** "63.5", "17", "0.75": decimals only when the PDF points produce them. */
export const formatScore = (value: number) => scoreFormat.format(value);

/** The PDF defines no pass mark; HR can decide only once the Promotion Board assessments are recorded. */
export function hasUnassessedCriteria(evaluation: Pick<PromotionEvaluationResult, "criteria"> | null | undefined) {
  return Boolean(evaluation?.criteria?.some((criterion) => criterion.state === "unassessed"));
}

const EVIDENCE_CRITERIA = new Set<string>(["assignment", "awards", "board", "reputation"]);

function criterionNote(criterion: Criterion) {
  if (criterion.state === "unassessed") return "Not yet assessed by the Promotion Board";
  if (criterion.state === "missing") return criterion.key === "iper" ? "Two consecutive IPER periods are not on record yet" : "No verified records yet";
  const evidence = criterion.evidence as Record<string, unknown> | string[] | null | undefined;
  if (criterion.key === "seniority" && evidence && !Array.isArray(evidence) && typeof evidence.rankSince === "string") return `In present rank since ${formatDate(evidence.rankSince)}`;
  if (criterion.key === "iper" && Array.isArray(evidence) && evidence.length) return `Last two ratings: ${evidence.join(", ")}`;
  if (evidence && !Array.isArray(evidence) && typeof evidence.assessedOn === "string") {
    return `Assessed ${formatDate(evidence.assessedOn)}${typeof evidence.evidence === "string" ? ` — ${evidence.evidence}` : ""}`;
  }
  return null;
}

/** Every PDF criterion with earned / maximum points; unassessed and missing evidence are never shown as a plain zero. */
export function ScorecardBreakdown({ evaluation, onAddEvidence, className }: {
  evaluation: PromotionEvaluationResult;
  onAddEvidence?: (criterion: PromotionEvidenceCriterion) => void;
  className?: string;
}) {
  const criteria = evaluation.criteria ?? [];
  return (
    <ul aria-label="Scorecard breakdown" className={cn("divide-y divide-slate-100 rounded-xl border border-slate-200", className)}>
      {criteria.map((criterion) => {
        const note = criterionNote(criterion);
        const unassessed = criterion.state === "unassessed";
        return (
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={criterion.key}>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">{criterion.label}</p>
              {note ? <p className={cn("mt-0.5 text-[11px]", unassessed || criterion.state === "missing" ? "text-amber-700" : "text-slate-500")}>{note}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold text-slate-900">{unassessed ? "—" : formatScore(criterion.points)} / {formatScore(criterion.maximumPoints)}</span>
              {onAddEvidence && EVIDENCE_CRITERIA.has(criterion.key) ? (
                <button aria-label={`Add evidence for ${criterion.label}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => onAddEvidence(criterion.key as PromotionEvidenceCriterion)} type="button">
                  <FilePlus2 aria-hidden="true" className="size-3" />Add
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Eligibility is shown beside the score, never added to it (the PDF allocates it no points). */
export function eligibilityLabel(evaluation: Pick<PromotionEvaluationResult, "eligibility"> | null | undefined) {
  const record = evaluation?.eligibility?.record;
  if (!record) return "None on record";
  if (!record.rating) return `${record.name} — rating not recorded`;
  return `${record.name} — rating ${/^\d+(\.\d+)?$/.test(record.rating) ? `${record.rating}%` : record.rating}`;
}
