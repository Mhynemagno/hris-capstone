"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { nativeSelectClassName } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePositionOptions } from "@/hooks/use-administration";
import {
  useCreatePerformanceRating,
  useCreatePromotionEvaluation,
  useHrPromotionEmployee,
  usePromotionCriteria,
} from "@/hooks/use-promotion-eligibility";
import { performanceRatingSchema } from "@/schemas/promotion-eligibility";

/** performance_ratings.rating is a smallint checked 1..5. */
export const PERFORMANCE_RATING_OPTIONS = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Needs improvement" },
  { value: 3, label: "Satisfactory" },
  { value: 4, label: "Very satisfactory" },
  { value: 5, label: "Outstanding" },
] as const;

export function ratingLabel(rating: number) {
  const option = PERFORMANCE_RATING_OPTIONS.find((item) => item.value === rating);
  return option ? `${rating} – ${option.label}` : String(rating);
}

const recommendationLabels = {
  recommended: "Recommended",
  deferred: "Deferred",
  not_recommended: "Not recommended",
} as const;

type RatingFieldErrors = Partial<Record<"rating" | "reviewPeriodStartsOn" | "reviewPeriodEndsOn" | "notes", string>>;

export function HrPromotionReview({ employeeId }: { employeeId: string }) {
  const detail = useHrPromotionEmployee(employeeId);
  const criteria = usePromotionCriteria({ isActive: true });
  const positions = usePositionOptions();
  const createRating = useCreatePerformanceRating();
  const createEvaluation = useCreatePromotionEvaluation();
  const [ratingStart, setRatingStart] = useState("");
  const [ratingErrors, setRatingErrors] = useState<RatingFieldErrors>({});
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null);
  const [criterionError, setCriterionError] = useState<string | undefined>();
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationSuccess, setEvaluationSuccess] = useState<string | null>(null);

  if (detail.isLoading || criteria.isLoading) return <LoadingState label="Loading promotion review…" />;
  if (detail.error || !detail.data || criteria.error) {
    return <ErrorState message={detail.error?.message ?? criteria.error?.message ?? "Employee record was not found."} />;
  }
  const data = detail.data;
  const positionTitle = (positionId: number) =>
    positions.data?.find((position) => position.id === positionId)?.title ?? (positions.isLoading ? "Loading position…" : `Position #${positionId}`);

  async function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRatingError(null);
    setRatingSuccess(null);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const input = {
      employeeId,
      rating: form.rating === "" ? undefined : form.rating,
      reviewPeriodStartsOn: form.startsOn,
      reviewPeriodEndsOn: form.endsOn,
      notes: form.notes,
    };
    const parsed = performanceRatingSchema.safeParse(input);
    if (!parsed.success) {
      const next: RatingFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RatingFieldErrors;
        if (!next[key]) {
          next[key] =
            key === "rating"
              ? "Choose a rating from 1 to 5."
              : key === "reviewPeriodStartsOn" || (key === "reviewPeriodEndsOn" && !form.endsOn)
                ? "Enter a valid date."
                : issue.message;
        }
      }
      setRatingErrors(next);
      return;
    }
    setRatingErrors({});
    try {
      await createRating.mutateAsync(input);
      formElement.reset();
      setRatingStart("");
      setRatingSuccess("Performance rating saved.");
    } catch (cause) {
      setRatingError(cause instanceof Error ? cause.message : "Unable to save the performance rating.");
    }
  }

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
        targetPositionId: criterion.target_position_id,
        criterionId: criterion.id,
        evaluatedOn: form.evaluatedOn,
        recommendation: form.recommendation,
        notes: form.notes,
        evidence: [],
      });
      formElement.reset();
      setEvaluationSuccess(`Advisory review saved for ${positionTitle(criterion.target_position_id)}.`);
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
          <dt className="text-sm text-muted-foreground">Employment started</dt>
          <dd className="font-medium">{data.employee.employment_started_on}</dd>
        </div>
      </dl>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Existing evidence</h2>
        <p className="text-sm text-muted-foreground">
          {data.qualifications.length} qualifications · {data.certifications.length} certifications · {data.training.length} training records
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Performance ratings</h2>
        {data.ratings.length ? (
          <ul className="space-y-2">
            {data.ratings.map((rating) => (
              <li className="rounded-lg border p-3 text-sm" key={rating.id}>
                <span className="font-medium">{ratingLabel(rating.rating)}</span> · {rating.review_period_starts_on} to {rating.review_period_ends_on}
                {rating.notes ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{rating.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No performance ratings have been recorded.</p>
        )}
        <form className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" noValidate onSubmit={submitRating}>
          <h3 className="font-semibold sm:col-span-2">Record a performance rating</h3>
          <FormField error={ratingErrors.rating} htmlFor="rating" label="Overall rating" required>
            <select className={nativeSelectClassName} defaultValue="" id="rating" name="rating" required>
              <option value="">Choose a rating</option>
              {PERFORMANCE_RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} – {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <div className="hidden sm:block" />
          <FormField error={ratingErrors.reviewPeriodStartsOn} htmlFor="rating-start" label="Review period start" required>
            <Input id="rating-start" name="startsOn" onChange={(event) => setRatingStart(event.target.value)} required type="date" />
          </FormField>
          <FormField
            description="Must be on or after the start date."
            error={ratingErrors.reviewPeriodEndsOn}
            htmlFor="rating-end"
            label="Review period end"
            required
          >
            <Input id="rating-end" min={ratingStart || undefined} name="endsOn" required type="date" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField error={ratingErrors.notes} htmlFor="rating-notes" label="HR notes">
              <Textarea id="rating-notes" maxLength={2000} name="notes" />
            </FormField>
          </div>
          <div className="space-y-3 sm:col-span-2">
            {ratingError ? <ErrorState message={ratingError} /> : null}
            {ratingSuccess ? (
              <p className="text-sm font-medium text-primary" role="status">
                {ratingSuccess}
              </p>
            ) : null}
            <Button disabled={createRating.isPending} type="submit">
              {createRating.isPending ? "Saving rating…" : "Save rating"}
            </Button>
          </div>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Promotion recommendation</h2>
        <form className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" onSubmit={submitEvaluation}>
          <FormField
            description={criteria.data?.length ? "Each option is the target position for an active criteria set." : "No active criteria exist. Create criteria first."}
            error={criterionError}
            htmlFor="criterion"
            label="Target position (active criteria)"
            required
          >
            <select className={nativeSelectClassName} defaultValue="" id="criterion" name="criterionId" required>
              <option value="">Choose criteria</option>
              {criteria.data?.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {positionTitle(criterion.target_position_id)} · {criterion.minimum_years_of_service}+ yrs
                  {criterion.minimum_performance_rating ? ` · rating ≥ ${criterion.minimum_performance_rating}` : ""}
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
