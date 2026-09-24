/** How often HR screens re-check an AI analysis that is still running. */
export const ANALYSIS_POLL_MS = 5000;

const RUNNING = new Set(["queued", "processing"]);

/** A TanStack Query refetch interval: poll while any analysis is running, otherwise stop. */
export function analysisRefetchInterval(statuses: ReadonlyArray<string | null | undefined>): number | false {
  return statuses.some((status) => status != null && RUNNING.has(status)) ? ANALYSIS_POLL_MS : false;
}
