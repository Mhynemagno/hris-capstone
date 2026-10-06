"use client";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useMyPromotionEligibility } from "@/hooks/use-promotion-eligibility";

export function EmployeePromotionEligibility() {
  const query = useMyPromotionEligibility();
  if (query.isLoading) return <LoadingState label="Loading your promotion eligibility…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  if (!query.data) {
    return (
      <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        HR has not published a promotion-readiness review for you yet. You will see it here once one is recorded.
      </p>
    );
  }
  const { targetRankName, readiness } = query.data;
  return (
    <section className="max-w-3xl space-y-5">
      <p className="rounded-lg bg-muted p-3 text-sm">This is a readiness review, not an automatic promotion decision.</p>
      <dl className="grid gap-4 rounded-xl border p-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Target rank</dt>
          <dd className="mt-1 font-medium">{targetRankName}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Years of service</dt>
          <dd className="mt-1 font-medium">{readiness.yearsOfService}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Readiness</dt>
          <dd className="mt-1 font-medium">{readiness.isReady ? "Requirements met" : "Requirements pending"}</dd>
        </div>
      </dl>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Missing requirements</h2>
        {/* Checked against your current records, so a newly added certification counts right away. */}
        {readiness.missingRequirements.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {readiness.missingRequirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {readiness.yearsOfService < readiness.minimumYearsOfService
              ? `Every requirement is on record. ${readiness.minimumYearsOfService} years of service are needed.`
              : "Every requirement is on record."}
          </p>
        )}
      </section>
    </section>
  );
}
