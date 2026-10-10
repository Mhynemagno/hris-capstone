import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { ACTIVE_STAGES } from "@/lib/recruitment/application-stages";
import type { HrRegisteredApplicant, HrShortlistApplication } from "@/lib/types/database";
import { parseSort, type SortState } from "@/lib/workspace/table";
import { applicationStatusSchema, type ApplicationStatus } from "@/schemas/recruitment";

import type { StageResult } from "./stage-results";

export type QuickView = "active" | "candidates" | "hired" | "not-selected" | "not-yet-applied" | "all";
export const QUICK_VIEWS: { value: QuickView; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "candidates", label: "Candidates" },
  { value: "hired", label: "Hired" },
  { value: "not-selected", label: "Disqualified" },
  { value: "not-yet-applied", label: "Not yet applied" },
  { value: "all", label: "All" },
];

export type AiStatus = HrShortlistApplication["ai_score_status"];
const AI_STATUSES: readonly AiStatus[] = ["queued", "processing", "completed", "failed", "unscored"];

export type ApplicationListRow =
  | { kind: "application"; id: string; name: string; applicantNumber: string | null; jobId: number; jobTitle: string | null; status: ApplicationStatus; stageResult: StageResult; submittedAt: string; aiStatus: AiStatus; aiScore: number | null }
  | { kind: "registered"; id: string; name: string; applicantNumber: string | null; submittedAt: string; applicant: HrRegisteredApplicant };

export type ApplicationListParams = { quick: QuickView; stage: ApplicationStatus | ""; job: number | null; q: string; ai: AiStatus | ""; minScore: number | undefined; sort: SortState; page: number };

export const APPLICATION_SORT_KEYS = ["ai", "submitted", "name"] as const;
export const DEFAULT_APPLICATION_SORT: SortState = { key: "ai", direction: "desc" };
export const APPLICATION_SORT_ACCESSORS = {
  ai: (row: ApplicationListRow) => (row.kind === "application" && row.aiStatus === "completed" ? row.aiScore : null),
  submitted: (row: ApplicationListRow) => row.submittedAt,
  name: (row: ApplicationListRow) => row.name,
};

export function parseApplicationListParams(raw: Partial<Record<"quick" | "stage" | "job" | "q" | "ai" | "minScore" | "sort" | "page", string>>): ApplicationListParams {
  const quick = QUICK_VIEWS.some((view) => view.value === raw.quick) ? (raw.quick as QuickView) : "active";
  const stage = applicationStatusSchema.safeParse(raw.stage).success ? (raw.stage as ApplicationStatus) : "";
  const job = Number.isInteger(Number(raw.job)) && Number(raw.job) > 0 ? Number(raw.job) : null;
  const ai = AI_STATUSES.includes(raw.ai as AiStatus) ? (raw.ai as AiStatus) : "";
  const score = Number(raw.minScore);
  const minScore = raw.minScore && Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : undefined;
  const page = Math.trunc(Number(raw.page));
  return { quick, stage, job, q: (raw.q ?? "").trim(), ai, minScore, sort: parseSort(raw.sort, APPLICATION_SORT_KEYS, DEFAULT_APPLICATION_SORT), page: Number.isFinite(page) && page > 0 ? page : 1 };
}

function registeredName(applicant: HrRegisteredApplicant) {
  const name = [applicant.last_name, [applicant.first_name, applicant.middle_name, applicant.qualifier].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return name || applicant.full_name || applicant.email || "Applicant";
}

function quickMatches(quick: QuickView, status: ApplicationStatus) {
  if (quick === "active") return ACTIVE_STAGES.includes(status);
  if (quick === "candidates") return status === "Shortlisted";
  if (quick === "hired") return status === "Hired";
  if (quick === "not-selected") return status === "Not Selected";
  return quick === "all";
}

/** Applications (and, in the "Not yet applied" and "All" views, registered people) after every filter. */
export function buildApplicationRows(applications: HrShortlistApplication[], registered: HrRegisteredApplicant[], params: ApplicationListParams): ApplicationListRow[] {
  // An explicit stage or job (e.g. a dashboard or job-posting link) overrides the quick view.
  const quick: QuickView = params.stage || params.job ? "all" : params.quick;
  const term = params.q.toLowerCase();
  const matchesTerm = (row: ApplicationListRow) => !term || row.name.toLowerCase().includes(term) || (row.applicantNumber ?? "").includes(term);

  const applicationRows: ApplicationListRow[] = quick === "not-yet-applied" ? [] : applications
    .filter((application) => quickMatches(quick, application.status) && (!params.stage || application.status === params.stage) && (!params.job || application.job_opening_id === params.job))
    .map((application) => ({
      kind: "application" as const,
      id: application.id,
      name: application.applicant_name || `Application ${application.id.slice(0, 8)}`,
      applicantNumber: formatApplicantNumber(application.applicant_number),
      jobId: application.job_opening_id,
      jobTitle: application.job_title ?? null,
      status: application.status,
      stageResult: application.stage_result ?? "pending",
      submittedAt: application.submitted_at,
      aiStatus: application.ai_score_status,
      aiScore: application.ai_score,
    }));

  const includeRegistered = (quick === "not-yet-applied" || quick === "all") && !params.stage && !params.job && !params.ai && params.minScore === undefined;
  const registeredRows: ApplicationListRow[] = includeRegistered ? registered.filter((applicant) => applicant.application_count === 0).map((applicant) => ({
    kind: "registered" as const,
    id: applicant.user_id,
    name: registeredName(applicant),
    applicantNumber: formatApplicantNumber(applicant.applicant_number),
    submittedAt: applicant.registered_at,
    applicant,
  })) : [];

  return [...applicationRows, ...registeredRows].filter(matchesTerm);
}
