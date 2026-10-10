"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRankOptions } from "@/hooks/use-administration";
import { formatDate } from "@/lib/format-date";
import { rankLabel } from "@/lib/ranks";
import {
  useCreatePromotionEvaluation,
  useHrPromotionEmployee,
  usePromotionCriteria,
  usePromotionReadiness,
} from "@/hooks/use-promotion-eligibility";

import { PerformanceEvaluation } from "./performance-evaluation";

const recommendationLabels = {
  recommended: "Recommended",
  deferred: "Deferred",
  not_recommended: "Not recommended",
} as const;

export function HrPromotionReview({ employeeId }: { employeeId: string }) {
  const detail = useHrPromotionEmployee(employeeId);
  const criteria = usePromotionCriteria({ isActive: true });
  const readiness = usePromotionReadiness(employeeId);
  const ranks = useRankOptions();
  const createEvaluation = useCreatePromotionEvaluation();
  const [criterionError, setCriterionError] = useState<string | undefined>();
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationSuccess, setEvaluationSuccess] = useState<string | null>(null);

  if (detail.isLoading || criteria.isLoading) return <LoadingState label="Loading promotion review…" />;
  if (detail.error || !detail.data || criteria.error) {
    return <ErrorState message={detail.error?.message ?? criteria.error?.message ?? "Employee record was not found."} />;
  }
  const data = detail.data;
  const latestReadiness = readiness.data?.[0];
  const rankTitle = (rankId: number) => {
    const rank = ranks.data?.find((row) => row.id === rankId);
    return rank ? rankLabel(rank) : ranks.isLoading ? "Loading rank…" : `Rank #${rankId}`;
  };

  async function submitEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvaluationError(null);
    setEvaluationSuccess(null);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const criterion = criteria.data?.find((item) => item.id === form.criterionId);
    if (!criterion) {
      setCriterionError("Choose active promotion criteria.");
      return;
    }
    setCriterionError(undefined);
    try {
      await createEvaluation.mutateAsync({
        employeeId,
        targetRankId: criterion.target_rank_id,
        criterionId: criterion.id,
        evaluatedOn: form.evaluatedOn,
        recommendation: form.recommendation,
        notes: form.notes,
        evidence: [],
      });
      formElement.reset();
      setEvaluationSuccess(`Advisory review saved for ${rankTitle(criterion.target_rank_id)}.`);
    } catch (cause) {
      setEvaluationError(cause instanceof Error ? cause.message : "Unable to save the promotion review.");
    }
  }

  return (
    <section className="max-w-4xl space-y-6">
      <p className="rounded-lg bg-muted p-3 text-sm">This review is advisory. It does not promote the employee automatically.</p>
      <dl className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Employee</dt>
          <dd className="font-medium">
            {data.employee.first_name} {data.employee.last_name}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Date Entered Service</dt>
          <dd className="font-medium">{formatDate(data.employee.employment_started_on) ?? "—"}</dd>
        </div>
      </dl>
      {latestReadiness ? (
        <section aria-labelledby="readiness-today" className="space-y-2">
          <h2 className="text-lg font-bold" id="readiness-today">Requirements as of today</h2>
          <p className="text-sm text-muted-foreground">
            For {latestReadiness.target_rank_name}, from the review on {formatDate(latestReadiness.evaluated_on)}, checked against current records.
          </p>
          <ul aria-label="Requirements as of today" className="divide-y rounded-xl border text-sm">
            {latestReadiness.readiness.requirements.map((requirement) => (
              <li className="flex items-center justify-between gap-3 px-4 py-2" key={requirement.label}>
                <span>{requirement.label}</span>
                <span className={requirement.met ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-destructive"}>
                  {requirement.met ? "Met" : "Missing"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Existing evidence</h2>
        <p className="text-sm text-muted-foreground">
          {data.qualifications.length} eligibility · {data.certifications.length + data.training.length} certification / training
        </p>
      </section>
      <PerformanceEvaluation certifications={data.certifications} employeeId={employeeId} employmentStartedOn={data.employee.employment_started_on} ratings={data.ratings} />
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Promotion recommendation</h2>
        <form className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" onSubmit={submitEvaluation}>
          <FormField
            description={criteria.data?.length ? "Each option is the target rank for an active criteria set." : "No active criteria exist. Create criteria first."}
            error={criterionError}
            htmlFor="criterion"
            label="Target rank (active criteria)"
            required
          >
            <select className={nativeSelectClassName} defaultValue="" id="criterion" name="criterionId" required>
              <option value="">Choose criteria</option>
              {criteria.data?.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {rankTitle(criterion.target_rank_id)} · {criterion.minimum_years_of_service}+ yrs
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="evaluation-date" label="Evaluation date" required>
            <Input id="evaluation-date" name="evaluatedOn" required type="date" />
          </FormField>
          <FormField htmlFor="recommendation" label="Recommendation" required>
            <select className={nativeSelectClassName} id="recommendation" name="recommendation">
              {Object.entries(recommendationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField htmlFor="evaluation-notes" label="HR notes">
              <Textarea id="evaluation-notes" maxLength={2000} name="notes" />
            </FormField>
          </div>
          <div className="space-y-3 sm:col-span-2">
            {evaluationError ? <ErrorState message={evaluationError} /> : null}
            {evaluationSuccess ? (
              <p className="text-sm font-medium text-primary" role="status">
                {evaluationSuccess}
              </p>
            ) : null}
            <Button disabled={createEvaluation.isPending || !criteria.data?.length} type="submit">
              {createEvaluation.isPending ? "Saving review…" : "Save advisory review"}
            </Button>
          </div>
        </form>
      </section>
    </section>
  );
}
