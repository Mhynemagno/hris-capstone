import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  applicantDocumentSchema,
  applicantProfileSchema,
  applicationAiFiltersSchema,
  applicationFiltersSchema,
  applicationStatusTransitionSchema,
  applicationSubmissionSchema,
  hiringDecisionSchema,
  jobFiltersSchema,
  jobOpeningSchema,
  type ApplicationSubmissionInput,
  type ApplicantProfileInput,
  type ApplicationAiFilters,
  type ApplicationFilters,
  type ApplicationStatusTransitionInput,
  type HiringDecisionInput,
  type JobFilters,
  type JobOpeningInput,
} from "@/schemas/recruitment";
import type { Applicant, Application, ApplicationAiScore, ApplicantDocument, ApplicationStatusHistory, HrShortlistApplication, JobOpening, JobQualificationCriterion, PaginatedResult } from "@/lib/types/database";

type PendingApplicantDocument = {
  kind: "cv" | "credential";
  file: File;
};

type SubmitApplicationInput = Omit<ApplicationSubmissionInput, "documents"> & {
  documents: PendingApplicantDocument[];
};

export class ApplicantProfileRequiredError extends Error {
  readonly code = "APPLICANT_PROFILE_REQUIRED" as const;

  constructor() {
    super("Complete your applicant profile before applying.");
    this.name = "ApplicantProfileRequiredError";
  }
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function extensionFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "png", "jpg", "jpeg"].includes(extension)) {
    throw new Error("Choose a PDF, PNG, or JPEG file.");
  }
  return extension === "jpg" ? "jpeg" : extension;
}

function pageRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

async function requireCurrentUser() {
  const { data, error } = await createBrowserSupabaseClient().auth.getUser();
  throwIfError(error);
  if (!data.user) throw new Error("Sign in to continue.");
  return data.user;
}

export async function listPublishedJobs(input: Partial<JobFilters> = {}) {
  const filters = jobFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  let query = createBrowserSupabaseClient()
    .from("job_openings")
    .select("*, job_qualification_criteria(*)", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Array<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }>, count: count ?? 0, filters } satisfies PaginatedResult<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }, JobFilters>;
}

export async function getPublishedJob(jobId: number) {
  const id = jobOpeningSchema.shape.id.unwrap().parse(jobId);
  const { data, error } = await createBrowserSupabaseClient()
    .from("job_openings")
    .select("*, job_qualification_criteria(*)")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data as (JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }) | null;
}

export async function getApplicantProfile() {
  const { data, error } = await createBrowserSupabaseClient().from("applicants").select("*").maybeSingle();
  throwIfError(error);
  return data as Applicant | null;
}

export async function saveApplicantProfile(input: ApplicantProfileInput) {
  const values = applicantProfileSchema.parse(input);
  const user = await requireCurrentUser();
  const { data, error } = await createBrowserSupabaseClient()
    .from("applicants")
    .upsert({
      profile_id: user.id,
      first_name: values.firstName,
      middle_name: values.middleName ?? null,
      last_name: values.lastName,
      phone: values.phone ?? null,
      address: values.address ?? null,
    }, { onConflict: "profile_id" })
    .select("*")
    .single();
  throwIfError(error);
  return data as Applicant;
}

export async function listMyApplications(input: Partial<ApplicationFilters> = {}) {
  const filters = applicationFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  let query = createBrowserSupabaseClient()
    .from("applications")
    .select("*, job_openings(id, title, location, status)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.jobId) query = query.eq("job_opening_id", filters.jobId);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Application[], count: count ?? 0, filters } satisfies PaginatedResult<Application, ApplicationFilters>;
}

export async function getMyApplication(applicationId: string) {
  const id = applicationStatusTransitionSchema.shape.applicationId.parse(applicationId);
  const client = createBrowserSupabaseClient();
  const [{ data: application, error: applicationError }, { data: history, error: historyError }, { data: documents, error: documentsError }] = await Promise.all([
    client.from("applications").select("*, job_openings(*), applicants(*)").eq("id", id).maybeSingle(),
    client.from("application_status_history").select("*").eq("application_id", id).order("created_at"),
    client.from("applicant_documents").select("*").eq("application_id", id).order("created_at"),
  ]);
  throwIfError(applicationError); throwIfError(historyError); throwIfError(documentsError);
  return application ? { application: application as Application, history: (history ?? []) as ApplicationStatusHistory[], documents: (documents ?? []) as ApplicantDocument[] } : null;
}

export async function listHrJobs(input: Partial<JobFilters> = {}) {
  const filters = jobFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  let query = createBrowserSupabaseClient().from("job_openings").select("*, job_qualification_criteria(*)", { count: "exact" }).order("updated_at", { ascending: false });
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Array<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }>, count: count ?? 0, filters } satisfies PaginatedResult<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }, JobFilters>;
}

export async function saveJobOpening(input: JobOpeningInput, jobId?: number) {
  const values = jobOpeningSchema.parse(input);
  const user = await requireCurrentUser();
  const client = createBrowserSupabaseClient();
  const payload = {
    department_id: values.departmentId,
    position_id: values.positionId,
    title: values.title,
    description: values.description,
    location: values.location ?? null,
    closes_on: values.closesOn ?? null,
    status: values.status,
    published_at: values.status === "published" ? new Date().toISOString() : null,
    created_by_user_id: user.id,
  };
  const result = jobId
    ? await client.from("job_openings").update(payload).eq("id", jobId).select("*").single()
    : await client.from("job_openings").insert(payload).select("*").single();
  throwIfError(result.error);
  const job = result.data as JobOpening;
  if (jobId) {
    const { error } = await client.from("job_qualification_criteria").delete().eq("job_opening_id", job.id);
    throwIfError(error);
  }
  const { error } = await client.from("job_qualification_criteria").insert(values.criteria.map((criterion, index) => ({
    job_opening_id: job.id,
    ordinal: index + 1,
    kind: criterion.kind,
    requirement: criterion.requirement,
    is_required: criterion.isRequired,
  })));
  throwIfError(error);
  return job;
}

export async function listHrApplications(input: Partial<ApplicationAiFilters> = {}) {
  const filters = applicationAiFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  const { data, error } = await createBrowserSupabaseClient()
    .rpc("list_hr_application_shortlist", { target_application_status: filters.status ?? null, target_ai_status: filters.aiStatus ?? null, minimum_score: filters.minimumScore ?? null })
    .range(from, to);
  throwIfError(error);
  const rows = (data ?? []).map((row: { application_id: string; applicant_id: string; job_opening_id: number; application_status: Application["status"]; submitted_at: string; ai_score_id: string | null; ai_score_status: HrShortlistApplication["ai_score_status"] | null; ai_score: number | null; ai_explanation: string | null; ai_model: string | null }) => ({ id: row.application_id, applicant_id: row.applicant_id, job_opening_id: row.job_opening_id, status: row.application_status, submitted_at: row.submitted_at, ai_score_id: row.ai_score_id, ai_score_status: row.ai_score_status ?? "unscored", ai_score: row.ai_score, ai_explanation: row.ai_explanation, ai_model: row.ai_model })) as HrShortlistApplication[];
  return { rows, count: rows.length, filters } satisfies PaginatedResult<HrShortlistApplication, ApplicationAiFilters>;
}

export async function transitionApplicationStatus(input: ApplicationStatusTransitionInput) {
  const values = applicationStatusTransitionSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("transition_application_status", {
    target_application_id: values.applicationId,
    target_next_status: values.nextStatus,
    transition_note: values.note ?? null,
  });
  throwIfError(error);
}

export async function getApplicationAiScores(applicationId: string) {
  const id = applicationStatusTransitionSchema.shape.applicationId.parse(applicationId);
  const { data, error } = await createBrowserSupabaseClient().from("application_ai_scores").select("*").eq("application_id", id).order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []) as ApplicationAiScore[];
}

export async function retryApplicationAnalysis(applicationId: string) {
  const id = applicationStatusTransitionSchema.shape.applicationId.parse(applicationId);
  const { data, error } = await createBrowserSupabaseClient().rpc("retry_application_analysis", {
    target_application_id: id,
  });
  throwIfError(error);
  return applicationStatusTransitionSchema.shape.applicationId.parse(data);
}

export async function submitApplication(input: SubmitApplicationInput) {
  const client = createBrowserSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const user = userData.user;
  if (!user) throw new Error("Sign in as an applicant before submitting an application.");

  const { data: applicant, error: applicantError } = await client
    .from("applicants")
    .select("id")
    .maybeSingle();
  throwIfError(applicantError);
  if (!applicant) throw new ApplicantProfileRequiredError();

  const uploadedDocuments = [];
  const bucket = client.storage.from("applicant-documents");
  for (const document of input.documents) {
    const documentId = crypto.randomUUID();
    const extension = extensionFor(document.file);
    const objectPath = `applicants/${user.id}/${input.applicationId}/${documentId}.${extension}`;
    const metadata = applicantDocumentSchema.parse({
      kind: document.kind,
      objectPath,
      fileName: document.file.name,
      mimeType: document.file.type,
      sizeBytes: document.file.size,
    });
    const { error } = await bucket.upload(objectPath, document.file, {
      contentType: metadata.mimeType,
      upsert: false,
    });
    throwIfError(error);
    uploadedDocuments.push(metadata);
  }

  const values = applicationSubmissionSchema.parse({
    applicationId: input.applicationId,
    jobId: input.jobId,
    coverNote: input.coverNote,
    documents: uploadedDocuments,
  });
  const { data, error } = await client.rpc("submit_application", {
    target_application_id: values.applicationId,
    target_job_opening_id: values.jobId,
    submitted_cover_note: values.coverNote ?? null,
    submitted_documents: values.documents,
  });
  throwIfError(error);
  return (data as string | null) ?? values.applicationId;
}

export async function hireApplication(input: HiringDecisionInput) {
  const values = hiringDecisionSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("hire_application", {
    target_application_id: values.applicationId,
    target_employee_number: values.employeeNumber,
    target_department_id: values.departmentId,
    target_position_id: values.positionId,
    target_employment_started_on: values.employmentStartedOn,
    decision_note: values.note ?? null,
  });
  throwIfError(error);
  return data as string;
}

const applicantDocumentPath = /^applicants\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|doc|docx|png|jpe?g)$/i;

export async function getApplicantDocumentUrl(objectPath: string) {
  if (!applicantDocumentPath.test(objectPath)) {
    throw new Error("Invalid applicant document path");
  }
  const { data, error } = await createBrowserSupabaseClient()
    .storage
    .from("applicant-documents")
    .createSignedUrl(objectPath, 60);
  throwIfError(error);
  return data?.signedUrl ?? null;
}

export type { PendingApplicantDocument, SubmitApplicationInput };
