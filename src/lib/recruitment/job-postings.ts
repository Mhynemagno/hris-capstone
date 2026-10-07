import type { SortState } from "@/lib/workspace/table";

export type HrJobLike = { id: number; title: string; location: string | null; status: "draft" | "published" | "closed"; closes_on: string | null; updated_at: string; applications?: Array<{ count: number }> };

export const JOB_STATUS_LABELS = { draft: "Draft", published: "Published", closed: "Closed" } as const;
export const JOB_SORT_KEYS = ["title", "deadline", "updated"] as const;
export const DEFAULT_JOB_SORT: SortState = { key: "updated", direction: "desc" };
export const JOB_SORT_ACCESSORS = {
  title: (job: HrJobLike) => job.title,
  deadline: (job: HrJobLike) => job.closes_on,
  updated: (job: HrJobLike) => job.updated_at,
};

export function applicationCount(job: HrJobLike) {
  return job.applications?.[0]?.count ?? 0;
}

export function jobActions(job: HrJobLike) {
  const canDelete = job.status === "draft" && applicationCount(job) === 0;
  return { canDelete, canWithdraw: job.status !== "closed" && !canDelete };
}

const DAY = 86_400_000;

function dayNumber(isoDay: string) {
  const [year, month, day] = isoDay.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / DAY;
}

/** "Closes in 5 days", counted in the Philippine calendar. */
export function deadlineNote(closesOn: string | null, status: HrJobLike["status"], today = new Date()) {
  if (status === "closed") return "Closed";
  if (!closesOn) return null;
  const days = Math.round(dayNumber(closesOn) - dayNumber(today.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })));
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Closes today";
  return `Closes in ${days} ${days === 1 ? "day" : "days"}`;
}

export function filterJobs<T extends HrJobLike>(jobs: T[], filters: { status: string; q: string }) {
  const term = filters.q.trim().toLowerCase();
  const status = filters.status in JOB_STATUS_LABELS ? filters.status : "";
  return jobs.filter((job) => (!status || job.status === status) && (!term || job.title.toLowerCase().includes(term) || (job.location ?? "").toLowerCase().includes(term)));
}

export function jobStatusCounts(jobs: HrJobLike[]) {
  return {
    all: jobs.length,
    published: jobs.filter((job) => job.status === "published").length,
    draft: jobs.filter((job) => job.status === "draft").length,
    closed: jobs.filter((job) => job.status === "closed").length,
  };
}
