"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRecordPerformanceEvaluation } from "@/hooks/use-promotion-eligibility";
import { formatDateRange } from "@/lib/format-date";
import { COURSE_POINTS, computePerformanceRubric, GRADE_SCALE, SERVICE_POINT_BANDS } from "@/lib/promotion/performance-rubric";
import type { Certification, PerformanceRating } from "@/lib/types/database";
import { performanceEvaluationSchema } from "@/schemas/promotion-eligibility";

/** Labels for ratings recorded before the rubric, when HR chose 1–5 directly. */
const LEGACY_RATING_LABELS: Record<number, string> = { 1: "Poor", 2: "Needs improvement", 3: "Satisfactory", 4: "Very satisfactory", 5: "Outstanding" };

export function ratingSummary(rating: Pick<PerformanceRating, "rating" | "total_points" | "grade_equivalent" | "descriptive_rating">) {
  if (rating.total_points !== null && rating.total_points !== undefined) return `${rating.total_points} / 100 · ${rating.grade_equivalent} ${rating.descriptive_rating}`;
  return `${rating.rating} – ${LEGACY_RATING_LABELS[rating.rating] ?? ""}`.trim();
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

type FieldErrors = Partial<Record<"reviewPeriodStartsOn" | "reviewPeriodEndsOn" | "notes", string>>;
type RubricCertification = Pick<Certification, "name" | "expires_on"> & { category?: Certification["category"] };

/** The client's points rubric: a live score from service years and courses, the saved evaluations, and the form to record one. */
export function PerformanceEvaluation({ employeeId, employmentStartedOn, certifications, ratings }: { employeeId: string; employmentStartedOn: string; certifications: RubricCertification[]; ratings: PerformanceRating[] }) {
  const record = useRecordPerformanceEvaluation();
  const [startsOn, setStartsOn] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const score = computePerformanceRubric({ employmentStartedOn, asOf: today(), certifications: certifications.map((course) => ({ name: course.name, category: course.category ?? null, expires_on: course.expires_on })) });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const input = { employeeId, reviewPeriodStartsOn: form.startsOn, reviewPeriodEndsOn: form.endsOn, notes: form.notes };
    const parsed = performanceEvaluationSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= key === "reviewPeriodEndsOn" && form.endsOn ? issue.message : key === "notes" ? issue.message : "Enter a valid date.";
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await record.mutateAsync(parsed.data);
      formElement.reset();
      setStartsOn("");
      setSuccess("Performance evaluation saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the performance evaluation.");
    }
  }

  const rows = [
    { label: `Length of service (${score.yearsOfService} ${score.yearsOfService === 1 ? "year" : "years"})`, points: score.servicePoints, max: 50 },
    { label: `Mandatory career courses (${score.mandatoryCount})`, points: score.mandatoryPoints, max: COURSE_POINTS.mandatory_course.cap },
    { label: `Specialized unit training (${score.specializedCount})`, points: score.specializedPoints, max: COURSE_POINTS.specialized_training.cap },
  ];

  return (
    <section aria-labelledby="performance-evaluation" className="space-y-4">
      <h2 className="text-lg font-bold" id="performance-evaluation">Performance evaluation</h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Score as of today, from the Date Entered Service and the Certification / Training records.</p>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Evaluation summary</caption>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b" key={row.label}>
                  <th className="py-2 text-left font-medium" scope="row">{row.label}</th>
                  <td className="py-2 text-right tabular-nums">{row.points} / {row.max}</td>
                </tr>
              ))}
              <tr>
                <th className="pt-3 text-left font-bold" scope="row">Total score</th>
                <td className="pt-3 text-right text-xl font-bold text-primary tabular-nums">{score.totalPoints} / 100</td>
              </tr>
            </tbody>
          </table>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Grade equivalent</dt><dd className="mt-1 text-lg font-bold tabular-nums">{score.grade}</dd></div>
            <div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Descriptive rating</dt><dd className="mt-1 text-lg font-bold">{score.rating}</dd></div>
            <div className="rounded-lg bg-muted/60 p-3"><dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Remarks</dt><dd className={score.ratingValue >= 3 ? "mt-1 font-semibold text-emerald-700 dark:text-emerald-400" : "mt-1 font-semibold text-destructive"}>{score.remarks}</dd></div>
          </dl>
        </div>
        <div className="space-y-4 rounded-xl border bg-card p-5 text-sm">
          <table className="w-full">
            <caption className="mb-2 text-left font-bold">Rating scale</caption>
            <thead><tr className="text-left text-muted-foreground"><th className="pb-1 font-medium" scope="col">Total points</th><th className="pb-1 font-medium" scope="col">Grade</th><th className="pb-1 font-medium" scope="col">Rating</th></tr></thead>
            <tbody>{GRADE_SCALE.map((band) => <tr className="border-t" key={band.grade}><td className="py-1.5 tabular-nums">{band.label}</td><td className="py-1.5 tabular-nums">{band.grade}</td><td className="py-1.5">{band.rating}</td></tr>)}</tbody>
          </table>
          <table className="w-full">
            <caption className="mb-2 text-left font-bold">Years of service points</caption>
            <tbody>{SERVICE_POINT_BANDS.map((band) => <tr className="border-t" key={band.label}><td className="py-1.5">{band.label}</td><td className="py-1.5 text-right tabular-nums">{band.points} pts</td></tr>)}</tbody>
          </table>
          <p className="text-muted-foreground">{COURSE_POINTS.mandatory_course.label}: {COURSE_POINTS.mandatory_course.perCourse} pts each, up to {COURSE_POINTS.mandatory_course.cap}. {COURSE_POINTS.specialized_training.label}: {COURSE_POINTS.specialized_training.perCourse} pts each, up to {COURSE_POINTS.specialized_training.cap}.</p>
        </div>
      </div>
      <h3 className="font-bold">Saved evaluations</h3>
      {ratings.length ? (
        <ul className="space-y-2">
          {ratings.map((rating) => (
            <li className="rounded-lg border p-3 text-sm" key={rating.id}>
              <span className="font-medium">{ratingSummary(rating)}</span> · {formatDateRange(rating.review_period_starts_on, rating.review_period_ends_on)}
              {rating.notes ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{rating.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No performance evaluations have been recorded.</p>
      )}
      <form className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" noValidate onSubmit={submit}>
        <h3 className="font-bold sm:col-span-2">Record an evaluation</h3>
        <p className="text-sm text-muted-foreground sm:col-span-2">The score is calculated as of the review period end and saved with the evaluation.</p>
        <FormField error={errors.reviewPeriodStartsOn} htmlFor="rating-start" label="Review period start" required>
          <Input id="rating-start" name="startsOn" onChange={(event) => setStartsOn(event.target.value)} required type="date" />
        </FormField>
        <FormField description="Must be on or after the start date." error={errors.reviewPeriodEndsOn} htmlFor="rating-end" label="Review period end" required>
          <Input id="rating-end" min={startsOn || undefined} name="endsOn" required type="date" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField error={errors.notes} htmlFor="rating-notes" label="HR notes">
            <Textarea id="rating-notes" maxLength={2000} name="notes" />
          </FormField>
        </div>
        <div className="space-y-3 sm:col-span-2">
          {error ? <ErrorState message={error} /> : null}
          {success ? <p className="text-sm font-medium text-primary" role="status">{success}</p> : null}
          <Button disabled={record.isPending} type="submit">{record.isPending ? "Saving evaluation…" : "Save evaluation"}</Button>
        </div>
      </form>
    </section>
  );
}
