"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyTableState } from "@/components/ui/empty-table-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useRankOptions } from "@/hooks/use-administration";
import { formatDate } from "@/lib/format-date";
import { rankLabel } from "@/lib/ranks";
import type { PromotionReadiness } from "@/lib/types/database";
import { usePromotionReadiness } from "@/hooks/use-promotion-eligibility";

const recommendationLabels: Record<string, string> = {
  recommended: "Recommended",
  deferred: "Deferred",
  not_recommended: "Not recommended",
};

function readinessText(readiness: PromotionReadiness) {
  if (readiness.isReady) return "Ready";
  const missing = readiness.missingRequirements.length;
  if (!missing) return `Needs ${readiness.minimumYearsOfService} years of service`;
  return `Missing ${missing} requirement${missing === 1 ? "" : "s"}`;
}

export function HrPromotionDirectory() {
  // One row per reviewed employee (their latest review); readiness is checked against today's records.
  const query = usePromotionReadiness();
  const ranks = useRankOptions();
  if (query.isLoading) return <LoadingState label="Loading promotion reviews…" />;
  if (query.error) return <ErrorState message={query.error.message} />;
  const rows = query.data ?? [];
  const rankTitle = (rankId: number) => {
    const rank = ranks.data?.find((row) => row.id === rankId);
    return rank ? rankLabel(rank) : `Rank #${rankId}`;
  };

  return (
    <section className="space-y-4">
      <p className="rounded-lg bg-muted p-3 text-sm">
        Promotion reviews advise HR; they never change an employee’s rank automatically.
      </p>
      <div className="flex justify-end">
        <Link className={buttonVariants({ variant: "outline" })} href="/hr/promotions/criteria">
          Manage criteria
        </Link>
      </div>
      <div className="relative overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Promotion reviews</caption>
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Employee</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Target rank</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Last reviewed</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Readiness</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Recommendation</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground" scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr className="border-t" key={row.employee_id}>
                  <td className="px-4 py-3 align-top font-medium">{row.employee_name}</td>
                  <td className="px-4 py-3 align-top">{rankTitle(row.target_rank_id)}</td>
                  <td className="px-4 py-3 align-top">{formatDate(row.evaluated_on)}</td>
                  <td className="px-4 py-3 align-top">{readinessText(row.readiness)}</td>
                  <td className="px-4 py-3 align-top">{recommendationLabels[row.recommendation] ?? row.recommendation}</td>
                  <td className="px-4 py-3 align-top">
                    <Link
                      aria-label={`Open review for ${row.employee_name}, ${rankTitle(row.target_rank_id)}`}
                      className="font-medium text-primary underline underline-offset-4"
                      href={`/hr/promotions/${row.employee_id}`}
                    >
                      Open review
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <EmptyTableState
                  colSpan={6}
                  message="No promotion reviews have been recorded yet."
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
