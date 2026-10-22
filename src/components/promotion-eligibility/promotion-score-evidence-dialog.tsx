"use client";

import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffInput, StaffLabel, StaffSelect, StaffTextarea } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { useRecordPromotionAssignment, useRecordPromotionAward, useRecordPromotionBoardAssessment } from "@/hooks/use-promotion-scorecard";
import { PROMOTION_SCORECARD_POLICIES, type PromotionScoreBand } from "@/lib/promotion-policies";
import { promotionAssignmentInputSchema, promotionAwardInputSchema, promotionBoardAssessmentInputSchema } from "@/schemas/promotion-scorecard";

/** Scorecard criteria that rely on HR-entered evidence; seniority and IPER come from existing records. */
export type PromotionEvidenceCriterion = "assignment" | "awards" | "board" | "reputation";

const TITLES: Record<PromotionEvidenceCriterion, string> = {
  assignment: "Record assignment",
  awards: "Record award",
  board: "Record Promotion Board assessment",
  reputation: "Record service reputation assessment",
};

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

const formatPoints = (value: number) => `${value} ${value === 1 ? "pt" : "pts"}`;

function firstIssue(error: z.ZodError, fallback: string) {
  const issue = error.issues[0];
  return issue?.code === "custom" || issue?.code === "too_big" || issue?.code === "too_small" ? issue.message : fallback;
}

/**
 * HR records one verified piece of score evidence. Points, caps and award values come from the fixed
 * PDF policy; HR never types a point value except a bounded Promotion Board score.
 */
export function PromotionScoreEvidenceDialog({ employeeId, employeeName, band, criterion, presentRankId, onClose }: {
  employeeId: string;
  employeeName?: string;
  band: PromotionScoreBand;
  criterion: PromotionEvidenceCriterion;
  presentRankId: number;
  onClose: () => void;
}) {
  const policy = PROMOTION_SCORECARD_POLICIES[band];
  const recordAssignment = useRecordPromotionAssignment();
  const recordAward = useRecordPromotionAward();
  const recordBoard = useRecordPromotionBoardAssessment();
  const pending = recordAssignment.isPending || recordAward.isPending || recordBoard.isPending;
  const today = manilaToday();
  const [assignmentKey, setAssignmentKey] = useState("");
  const [region, setRegion] = useState("");
  const [startedOn, setStartedOn] = useState("");
  const [endedOn, setEndedOn] = useState("");
  const [awardKey, setAwardKey] = useState("");
  const [eventOn, setEventOn] = useState(criterion === "board" || criterion === "reputation" ? today : "");
  const [score, setScore] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assignmentRow = policy.assignmentRows.find((row) => row.key === assignmentKey);
  const boardMaximum = criterion === "board" || criterion === "reputation" ? policy.allocation[criterion] : 0;

  async function save() {
    if (criterion === "assignment") {
      const parsed = promotionAssignmentInputSchema.safeParse({
        employeeId,
        kind: assignmentRow?.regions ? "geographic" : assignmentKey,
        region: assignmentRow?.regions ? region || undefined : null,
        startedOn,
        endedOn,
        evidence,
      });
      if (!parsed.success) return firstIssue(parsed.error, "Choose the assignment type, enter its dates and the supporting evidence.");
      await recordAssignment.mutateAsync(parsed.data);
    } else if (criterion === "awards") {
      const parsed = promotionAwardInputSchema.safeParse({ employeeId, awardKey, awardedOn: eventOn, presentRankId, evidence });
      if (!parsed.success) return firstIssue(parsed.error, "Choose the award, enter the date awarded and the supporting evidence.");
      await recordAward.mutateAsync(parsed.data);
    } else {
      const parsed = promotionBoardAssessmentInputSchema.safeParse({ employeeId, criterion, band, assessedOn: eventOn, score: score === "" ? undefined : score, evidence });
      if (!parsed.success) return firstIssue(parsed.error, "Enter the assessment date, score and supporting evidence.");
      await recordBoard.mutateAsync(parsed.data);
    }
    return null;
  }

  async function submit() {
    if (pending) return;
    setError(null);
    try {
      const problem = await save();
      if (problem) { setError(problem); return; }
      notifyStaff({ title: "Score evidence recorded" });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the evidence.");
    }
  }

  return (
    <StaffModal
      footer={<>
        <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
        <button className={staffButton.primary} disabled={pending} onClick={() => void submit()} type="button">{pending ? "Saving…" : "Save"}</button>
      </>}
      icon={<FilePlus2 aria-hidden="true" className="size-4" />}
      iconClassName="bg-blue-900 text-amber-400 shadow-sm"
      onClose={onClose}
      open
      size="lg"
      subtitle={`${employeeName ? `${employeeName} · ` : ""}${band} scorecard. Points are computed from the official policy.`}
      title={TITLES[criterion]}
    >
      {criterion === "assignment" ? (
        <>
          <div>
            <StaffLabel htmlFor="score-evidence-assignment" required>Assignment type</StaffLabel>
            <StaffSelect id="score-evidence-assignment" onChange={(event) => { setAssignmentKey(event.target.value); setRegion(""); }} value={assignmentKey}>
              <option value="">Choose a type</option>
              {policy.assignmentRows.map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}
            </StaffSelect>
            {assignmentRow ? <p className="mt-1 text-xs text-slate-500">{formatPoints(assignmentRow.pointsPerSixMonths)} per 6 months, up to {formatPoints(assignmentRow.cap)}.</p> : null}
          </div>
          {assignmentRow?.regions ? (
            <div>
              <StaffLabel htmlFor="score-evidence-region" required>Region</StaffLabel>
              <StaffSelect id="score-evidence-region" onChange={(event) => setRegion(event.target.value)} value={region}>
                <option value="">Choose a region</option>
                {assignmentRow.regions.map((option) => <option key={option} value={option}>{option}</option>)}
              </StaffSelect>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <StaffLabel htmlFor="score-evidence-start" required>Assignment start</StaffLabel>
              <StaffInput id="score-evidence-start" max={today} onChange={(event) => setStartedOn(event.target.value)} type="date" value={startedOn} />
            </div>
            <div>
              <StaffLabel htmlFor="score-evidence-end" required>Assignment end</StaffLabel>
              <StaffInput id="score-evidence-end" max={today} min={startedOn || undefined} onChange={(event) => setEndedOn(event.target.value)} type="date" value={endedOn} />
            </div>
          </div>
        </>
      ) : criterion === "awards" ? (
        <>
          <div>
            <StaffLabel htmlFor="score-evidence-award" required>Award</StaffLabel>
            <StaffSelect id="score-evidence-award" onChange={(event) => setAwardKey(event.target.value)} value={awardKey}>
              <option value="">Choose an award</option>
              {policy.awards.map((award) => <option key={award.key} value={award.key}>{`${award.label} (${formatPoints(award.points)})`}</option>)}
            </StaffSelect>
            <p className="mt-1 text-xs text-slate-500">Only awards received at the present rank count, up to {formatPoints(policy.allocation.awards)}.</p>
          </div>
          <div>
            <StaffLabel htmlFor="score-evidence-date" required>Date awarded</StaffLabel>
            <StaffInput id="score-evidence-date" max={today} onChange={(event) => setEventOn(event.target.value)} type="date" value={eventOn} />
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <StaffLabel htmlFor="score-evidence-date" required>Date assessed</StaffLabel>
            <StaffInput id="score-evidence-date" max={today} onChange={(event) => setEventOn(event.target.value)} type="date" value={eventOn} />
          </div>
          <div>
            <StaffLabel htmlFor="score-evidence-score" required>{`Score (0–${boardMaximum})`}</StaffLabel>
            <StaffInput id="score-evidence-score" inputMode="decimal" max={boardMaximum} min={0} onChange={(event) => setScore(event.target.value)} step="0.01" type="number" value={score} />
          </div>
        </div>
      )}

      <div>
        <StaffLabel htmlFor="score-evidence-text" required>Supporting evidence</StaffLabel>
        <StaffTextarea id="score-evidence-text" maxLength={2000} onChange={(event) => setEvidence(event.target.value)} placeholder="Orders, citation, panel sheet or records reviewed" rows={3} value={evidence} />
      </div>

      {error ? <p className="font-semibold text-rose-700" role="alert">{error}</p> : null}
    </StaffModal>
  );
}
