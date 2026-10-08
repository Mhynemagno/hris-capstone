import { RECRUITMENT_RANK } from "@/lib/pnp-catalogue";
import { JOB_POSTING_IMAGE_BUCKET } from "@/lib/recruitment/job-posting-image";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { APPLICANT_PROFILE_DOCUMENT_KINDS, profileDocumentFileSchemaFor } from "@/schemas/applicant-portal";
import {
  applicantDocumentSchema,
  applicantProfilePhotoFileSchema,
  applicantProfileSchema,
  applicationAiFiltersSchema,
  applicationFiltersSchema,
  applicationRemarkSchema,
  applicationStatusTransitionSchema,
  applicationSubmissionSchema,
  hiringDecisionSchema,
  jobFiltersSchema,
  jobOpeningSchema,
  jobPostingImageFileSchema,
  type ApplicationSubmissionInput,
  type ApplicantProfileDocumentFile,
  type ApplicantProfileInput,
  type ApplicationAiFilters,
  type ApplicationFilters,
  type ApplicationRemarkInput,
  type ApplicationStatusTransitionInput,
  type HiringDecisionInput,
  type JobFilters,
  type JobOpeningInput,
} from "@/schemas/recruitment";
import type { Applicant, ApplicantProfileDocument, Application, AppliedJob, ApplicationAiScore, ApplicantDocument, ApplicationStatusHistory, HrShortlistApplication, JobOpening, JobQualificationCriterion, PaginatedResult } from "@/lib/types/database";

type PendingApplicantDocument = {
  kind: "cv" | "credential";
  file: File;
};

type PendingApplicantProfileDocuments = Partial<Record<ApplicantProfileDocument["kind"], ApplicantProfileDocumentFile>>;

type SubmitApplicationInput = Omit<ApplicationSubmissionInput, "documents"> & {
  documents: PendingApplicantDocument[];
};

type ResubmitApplicationInput = {
  applicationId: string;
  documents: PendingApplicantDocument[];
};

export class ApplicantProfileRequiredError extends Error {
  readonly code = "APPLICANT_PROFILE_REQUIRED" as const;

  constructor(
    message = "Complete your applicant profile before applying.",
    readonly actionHref = "/applicant/profile",
    readonly actionLabel = "Complete profile",
  ) {
    super(message);
    this.name = "ApplicantProfileRequiredError";
  }
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function throwApplicationSubmissionError(error: { message: string } | null) {
  if (error && /eligibility/i.test(error.message) && /diploma/i.test(error.message)) {
    throw new ApplicantProfileRequiredError(
      "Upload all required documents (Eligibility, Diploma, CV / Resume, PSA birth certificate, and 2x2 picture) on the Documents page before applying.",
      "/applicant/documents",
      "Update required documents",
    );
  }
  throwIfError(error);
}

function extensionFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "png", "jpg", "jpeg"].includes(extension)) {
    throw new Error("Choose a PDF, PNG, or JPEG file.");
  }
  return extension === "jpg" ? "jpeg" : extension;
}

const applicantProfilePhotoBucket = "applicant-profile-photos";
const applicantProfileDocumentBucket = "applicant-profile-documents";
const applicantProfilePhotoExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

/** The optional image change that accompanies a job-opening save. */
export type JobPostingImageChange = { file: File } | { remove: true };

const applicantProfileDocumentExtensions = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;

function pageRange(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Shown instead of supabase-js's "Auth session missing!" when the browser's sign-in has ended or was revoked. */
export const SESSION_ENDED_MESSAGE = "Your session has ended. Sign in again to continue.";

function throwIfAuthError(error: { message: string; name?: string } | null) {
  if (error?.name === "AuthSessionMissingError") throw new Error(SESSION_ENDED_MESSAGE);
  throwIfError(error);
}

async function requireCurrentUser() {
  const { data, error } = await createBrowserSupabaseClient().auth.getUser();
  throwIfAuthError(error);
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
    .eq("status", "published")
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
  const payload = {
    first_name: values.firstName,
    middle_name: values.middleName ?? null,
    last_name: values.lastName,
    qualifier: values.qualifier ?? null,
    place_of_birth: values.placeOfBirth ?? null,
    date_of_birth: values.dateOfBirth ?? null,
    gender: values.gender ?? null,
    civil_status: values.civilStatus ?? null,
    religion: values.religion ?? null,
    citizenship: values.citizenship ?? null,
    phone: values.phone ?? null,
    address: values.address ?? null,
  };
  const client = createBrowserSupabaseClient();
  const { data: existing, error: existingError } = await client.from("applicants").select("id").maybeSingle();
  throwIfError(existingError);
  const { data, error } = existing
    ? await client.from("applicants").update(payload).eq("profile_id", user.id).select("*").single()
    : await client.from("applicants").insert({ profile_id: user.id, ...payload }).select("*").single();
  throwIfError(error);
  return data as Applicant;
}

type ProfilePhotoApplicant = Pick<Applicant, "id" | "profile_image_path">;

export async function getApplicantProfilePhotoUrl(objectPath: string | null) {
  if (!objectPath) return null;
  const { data, error } = await createBrowserSupabaseClient().storage.from(applicantProfilePhotoBucket).createSignedUrl(objectPath, 600);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error("Unable to prepare the profile photo.");
  return data.signedUrl;
}

export async function replaceMyApplicantProfilePhoto(applicant: ProfilePhotoApplicant, file: File) {
  const validatedFile = applicantProfilePhotoFileSchema.parse(file);
  const extension = applicantProfilePhotoExtensions[validatedFile.type as keyof typeof applicantProfilePhotoExtensions];
  const objectPath = `applicants/${applicant.id}/${crypto.randomUUID()}.${extension}`;
  const client = createBrowserSupabaseClient();
  const bucket = client.storage.from(applicantProfilePhotoBucket);
  const { error: uploadError } = await bucket.upload(objectPath, validatedFile, { contentType: validatedFile.type, upsert: false });
  throwIfError(uploadError);
  const { error: updateError } = await client.rpc("update_my_applicant_profile_image_path", { target_path: objectPath });
  if (updateError) {
    await bucket.remove([objectPath]).catch(() => undefined);
    throw new Error(updateError.message);
  }
  if (!applicant.profile_image_path) return { path: objectPath, cleanupError: null };
  const { error: cleanupError } = await bucket.remove([applicant.profile_image_path]);
  return { path: objectPath, cleanupError: cleanupError?.message ?? null };
}

export async function removeMyApplicantProfilePhoto(applicant: ProfilePhotoApplicant) {
  if (!applicant.profile_image_path) return { cleanupError: null };
  const client = createBrowserSupabaseClient();
  const { error: updateError } = await client.rpc("update_my_applicant_profile_image_path", { target_path: null });
  throwIfError(updateError);
  const { error: cleanupError } = await client.storage.from(applicantProfilePhotoBucket).remove([applicant.profile_image_path]);
  return { cleanupError: cleanupError?.message ?? null };
}

export async function listApplicantProfileDocuments() {
  const { data, error } = await createBrowserSupabaseClient().from("applicant_profile_documents").select("*").order("kind");
  throwIfError(error);
  return (data ?? []) as ApplicantProfileDocument[];
}

/** HR: one applicant's saved required documents (RLS allows HR to read every applicant's). */
export async function listApplicantProfileDocumentsFor(applicantId: string) {
  const { data, error } = await createBrowserSupabaseClient().from("applicant_profile_documents").select("*").eq("applicant_id", applicantId).order("kind");
  throwIfError(error);
  return (data ?? []) as ApplicantProfileDocument[];
}

export async function getApplicantProfileDocumentUrl(objectPath: string) {
  const { data, error } = await createBrowserSupabaseClient().storage.from(applicantProfileDocumentBucket).createSignedUrl(objectPath, 600);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error("Unable to prepare the profile document.");
  return data.signedUrl;
}

/** The applicant's saved profile document as a File, so it can be attached to an application (the saved CV becomes the application's CV). */
export async function loadMyProfileDocumentFile(document: Pick<ApplicantProfileDocument, "object_path" | "file_name" | "mime_type">) {
  const { data, error } = await createBrowserSupabaseClient().storage.from(applicantProfileDocumentBucket).download(document.object_path);
  if (error || !data) throw new Error("We could not attach your saved CV. Try again.");
  // Attachments are named by extension, so a saved file named without one ("Resume") gets one from its type.
  const extension = applicantProfileDocumentExtensions[document.mime_type];
  const fileName = /\.(pdf|png|jpe?g)$/i.test(document.file_name) ? document.file_name : `${document.file_name}.${extension}`;
  return new File([data], fileName, { type: document.mime_type });
}

export async function saveApplicantProfileDocuments(documents: PendingApplicantProfileDocuments) {
  const user = await requireCurrentUser();
  const client = createBrowserSupabaseClient();
  const bucket = client.storage.from(applicantProfileDocumentBucket);
  const uploadedPaths: string[] = [];
  try {
    for (const { kind } of APPLICANT_PROFILE_DOCUMENT_KINDS) {
      const pending = documents[kind];
      if (!pending) continue;
      const file = profileDocumentFileSchemaFor(kind).parse(pending);
      const extension = applicantProfileDocumentExtensions[file.type as keyof typeof applicantProfileDocumentExtensions];
      const objectPath = `applicant-profiles/${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await bucket.upload(objectPath, file, { contentType: file.type, upsert: false });
      throwIfError(uploadError);
      uploadedPaths.push(objectPath);
      const { error: saveError } = await client.rpc("save_my_applicant_profile_document", {
        target_kind: kind,
        target_object_path: objectPath,
        target_file_name: file.name,
        target_mime_type: file.type,
        target_size_bytes: file.size,
      });
      throwIfError(saveError);
    }
  } catch (cause) {
    if (uploadedPaths.length > 0) await bucket.remove(uploadedPaths).catch(() => undefined);
    throw cause;
  }
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

export async function getMyApplicationForJob(jobId: number) {
  const id = jobOpeningSchema.shape.id.unwrap().parse(jobId);
  const { data, error } = await createBrowserSupabaseClient().from("applications").select("*").eq("job_opening_id", id).maybeSingle();
  throwIfError(error);
  return data as Application | null;
}

export async function getMyApplication(applicationId: string) {
  const id = applicationStatusTransitionSchema.shape.applicationId.parse(applicationId);
  const client = createBrowserSupabaseClient();
  const [{ data: application, error: applicationError }, { data: history, error: historyError }, { data: documents, error: documentsError }] = await Promise.all([
    client.from("applications").select("*, job_openings(id, title, description, location, closes_on, status, departments(name), ranks(name, code), job_qualification_criteria(id, kind, requirement, is_required, ordinal)), applicants(*)").eq("id", id).maybeSingle(),
    client.from("application_status_history").select("*").eq("application_id", id).order("created_at"),
    client.from("applicant_documents").select("*").eq("application_id", id).order("created_at"),
  ]);
  throwIfError(applicationError); throwIfError(historyError); throwIfError(documentsError);
  return application ? { application: application as Application & { job_openings: AppliedJob | null }, history: (history ?? []) as ApplicationStatusHistory[], documents: (documents ?? []) as ApplicantDocument[] } : null;
}

export async function listHrJobs(input: Partial<JobFilters> = {}) {
  const filters = jobFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  let query = createBrowserSupabaseClient().from("job_openings").select("*, job_qualification_criteria(*), applications(count)", { count: "exact" }).order("updated_at", { ascending: false });
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Array<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }>, count: count ?? 0, filters } satisfies PaginatedResult<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }, JobFilters>;
}

export type HrJob = JobOpening & { job_qualification_criteria: JobQualificationCriterion[]; applications?: Array<{ count: number }> };

const HR_JOB_SELECT = "*, job_qualification_criteria(*), applications(count)";

/** Every posting for the HR list, which filters, sorts and pages on the client. Move to server paging if volumes grow past ~1000. */
export async function listAllHrJobs(): Promise<HrJob[]> {
  const { data, error } = await createBrowserSupabaseClient().from("job_openings").select(HR_JOB_SELECT).order("updated_at", { ascending: false }).range(0, 999);
  throwIfError(error);
  return (data ?? []) as HrJob[];
}

export async function getHrJob(id: number): Promise<HrJob | null> {
  const { data, error } = await createBrowserSupabaseClient().from("job_openings").select(HR_JOB_SELECT).eq("id", id).maybeSingle();
  throwIfError(error);
  return (data as HrJob | null) ?? null;
}

export async function saveJobOpening(input: JobOpeningInput, jobId?: number, image?: JobPostingImageChange) {
  const values = jobOpeningSchema.parse(input);
  // No auth.getUser() round trip here: save_job_opening, set_job_opening_image and the storage policies
  // authorize the HR caller from the request's access token. getUser() asks the Auth server whether the
  // session still exists and fails with "Auth session missing!" (and signs this browser out) once it was
  // revoked elsewhere, even though the page and the token are still valid.
  const client = createBrowserSupabaseClient();
  // Every recruitment is for the Patrolman / Patrolwoman rank.
  const { data: rank, error: rankError } = await client.from("ranks").select("id").eq("code", RECRUITMENT_RANK.code).maybeSingle();
  throwIfError(rankError);
  const { data, error } = await client.rpc("save_job_opening", {
    target_job_id: jobId ?? null,
    // Job postings carry no department; on update the RPC keeps a saved one.
    target_department_id: null,
    target_rank_id: (rank as { id: number } | null)?.id ?? null,
    target_title: values.title,
    target_description: values.description,
    target_location: values.location,
    target_closes_on: values.closesOn,
    target_status: values.status,
    requested_criteria: values.criteria,
  });
  throwIfError(error);
  const job = data as JobOpening;
  if (!image) return job;
  const bucket = client.storage.from(JOB_POSTING_IMAGE_BUCKET);
  let objectPath: string | null = null;
  if ("file" in image) {
    const file = jobPostingImageFileSchema.parse(image.file);
    objectPath = `job-openings/${job.id}/${crypto.randomUUID()}.${applicantProfilePhotoExtensions[file.type as keyof typeof applicantProfilePhotoExtensions]}`;
    const { error: uploadError } = await bucket.upload(objectPath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`The job opening was saved, but its image could not be uploaded: ${uploadError.message}`);
  }
  const { data: previousPath, error: imageError } = await client.rpc("set_job_opening_image", { target_job_id: job.id, target_image_path: objectPath });
  if (imageError) {
    if (objectPath) await bucket.remove([objectPath]).catch(() => undefined);
    throw new Error(`The job opening was saved, but its image could not be updated: ${imageError.message}`);
  }
  // The replaced image is no longer referenced; a failed cleanup only leaves an orphaned public object.
  if (typeof previousPath === "string" && previousPath !== objectPath) await bucket.remove([previousPath]).catch(() => undefined);
  return { ...job, image_path: objectPath };
}

type ShortlistFilters = { status?: Application["status"]; aiStatus?: HrShortlistApplication["ai_score_status"]; minimumScore?: number };

async function fetchShortlist(filters: ShortlistFilters, from: number, to: number) {
  const { data, error } = await createBrowserSupabaseClient()
    .rpc("list_hr_application_shortlist", { target_application_status: filters.status ?? null, target_ai_status: filters.aiStatus ?? null, minimum_score: filters.minimumScore ?? null })
    .range(from, to);
  throwIfError(error);
  const shortlist = (data ?? []) as { application_id: string; applicant_id: string; job_opening_id: number; application_status: Application["status"]; submitted_at: string; ai_score_id: string | null; ai_score_status: HrShortlistApplication["ai_score_status"] | null; ai_score: number | null; ai_explanation: string | null; ai_model: string | null }[];
  // The shortlist RPC returns ids only; HR can read applicants and openings, so name them in two batched reads.
  const { applicants, jobs } = await shortlistNames(shortlist.map((row) => row.applicant_id), shortlist.map((row) => row.job_opening_id));
  return shortlist.map((row) => {
    const applicant = applicants.get(row.applicant_id);
    return {
      id: row.application_id, applicant_id: row.applicant_id, job_opening_id: row.job_opening_id, status: row.application_status, submitted_at: row.submitted_at,
      ai_score_id: row.ai_score_id, ai_score_status: row.ai_score_status ?? "unscored", ai_score: row.ai_score, ai_explanation: row.ai_explanation, ai_model: row.ai_model,
      applicant_name: applicant ? [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") || null : null,
      applicant_number: applicant?.applicant_number ?? null,
      job_title: jobs.get(row.job_opening_id) ?? null,
    };
  }) as HrShortlistApplication[];
}

export async function listHrApplications(input: Partial<ApplicationAiFilters> = {}) {
  const filters = applicationAiFiltersSchema.parse(input);
  const { from, to } = pageRange(filters.page, filters.pageSize);
  const rows = await fetchShortlist(filters, from, to);
  return { rows, count: rows.length, filters } satisfies PaginatedResult<HrShortlistApplication, ApplicationAiFilters>;
}

/** Every application for the HR list, which filters, sorts and pages on the client. Move to server paging if volumes grow past ~1000. */
export async function listAllHrApplications(filters: Omit<ShortlistFilters, "status"> = {}) {
  return fetchShortlist(filters, 0, 999);
}

async function shortlistNames(applicantIds: string[], jobIds: number[]) {
  const client = createBrowserSupabaseClient();
  const uniqueApplicants = [...new Set(applicantIds)];
  const uniqueJobs = [...new Set(jobIds)];
  const [applicantResult, jobResult] = await Promise.all([
    uniqueApplicants.length ? client.from("applicants").select("id, first_name, last_name, applicant_number").in("id", uniqueApplicants) : Promise.resolve({ data: [], error: null }),
    uniqueJobs.length ? client.from("job_openings").select("id, title").in("id", uniqueJobs) : Promise.resolve({ data: [], error: null }),
  ]);
  throwIfError(applicantResult.error); throwIfError(jobResult.error);
  return {
    applicants: new Map(((applicantResult.data ?? []) as { id: string; first_name: string | null; last_name: string | null; applicant_number: number | null }[]).map((row) => [row.id, row])),
    jobs: new Map(((jobResult.data ?? []) as { id: number; title: string }[]).map((row) => [row.id, row.title])),
  };
}

export type RecentApplication = { id: string; status: Application["status"]; submitted_at: string; applicant_name: string | null; job_title: string | null };

/** The newest submitted applications for the HR dashboard. */
export async function listRecentApplications(limit = 5): Promise<RecentApplication[]> {
  const { data, error } = await createBrowserSupabaseClient()
    .from("applications")
    .select("id, status, submitted_at, applicants(first_name, last_name), job_openings(title)")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return ((data ?? []) as unknown as Array<{ id: string; status: Application["status"]; submitted_at: string; applicants: { first_name: string | null; last_name: string | null } | null; job_openings: { title: string } | null }>).map((row) => ({
    id: row.id,
    status: row.status,
    submitted_at: row.submitted_at,
    applicant_name: row.applicants ? [row.applicants.first_name, row.applicants.last_name].filter(Boolean).join(" ") || null : null,
    job_title: row.job_openings?.title ?? null,
  }));
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
  throwIfAuthError(userError);
  const user = userData.user;
  if (!user) throw new Error("Sign in as an applicant before submitting an application.");

  const { data: applicant, error: applicantError } = await client
    .from("applicants")
    .select("id")
    .maybeSingle();
  throwIfError(applicantError);
  if (!applicant) throw new ApplicantProfileRequiredError();

  const uploadedDocuments = [];
  const uploadedPaths: string[] = [];
  const bucket = client.storage.from("applicant-documents");
  try {
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
      uploadedPaths.push(objectPath);
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
    throwApplicationSubmissionError(error);
    return (data as string | null) ?? values.applicationId;
  } catch (cause) {
    if (uploadedPaths.length > 0) {
      try { await bucket.remove(uploadedPaths); } catch { /* Preserve the submission error. */ }
    }
    throw cause;
  }
}

export async function deleteDraftJobOpening(jobId: number) {
  const id = jobOpeningSchema.shape.id.unwrap().parse(jobId);
  const { error } = await createBrowserSupabaseClient().rpc("delete_draft_job_opening", { target_job_id: id });
  throwIfError(error);
}

export async function withdrawJobOpening(jobId: number) {
  const id = jobOpeningSchema.shape.id.unwrap().parse(jobId);
  const { error } = await createBrowserSupabaseClient().rpc("withdraw_job_opening", { target_job_id: id });
  throwIfError(error);
}

export async function resubmitApplication(input: ResubmitApplicationInput) {
  const applicationId = applicationStatusTransitionSchema.shape.applicationId.parse(input.applicationId);
  const user = await requireCurrentUser();
  const client = createBrowserSupabaseClient();
  const bucket = client.storage.from("applicant-documents");
  const uploadedDocuments = [];
  const uploadedPaths: string[] = [];
  try {
    for (const document of input.documents) {
      const documentId = crypto.randomUUID();
      const extension = extensionFor(document.file);
      const objectPath = `applicants/${user.id}/${applicationId}/${documentId}.${extension}`;
      const metadata = applicantDocumentSchema.parse({
        kind: document.kind, objectPath, fileName: document.file.name, mimeType: document.file.type, sizeBytes: document.file.size,
      });
      const { error } = await bucket.upload(objectPath, document.file, { contentType: metadata.mimeType, upsert: false });
      throwIfError(error);
      uploadedPaths.push(objectPath);
      uploadedDocuments.push(metadata);
    }
    const { error } = await client.rpc("resubmit_application", { target_application_id: applicationId, submitted_documents: uploadedDocuments });
    throwIfError(error);
  } catch (cause) {
    if (uploadedPaths.length > 0) await bucket.remove(uploadedPaths).catch(() => undefined);
    throw cause;
  }
}

export async function hireApplication(input: HiringDecisionInput) {
  const values = hiringDecisionSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("hire_application", {
    target_application_id: values.applicationId,
    target_badge_number: values.badgeNumber,
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

export type { PendingApplicantDocument, PendingApplicantProfileDocuments, ResubmitApplicationInput, SubmitApplicationInput };

/** HR remark on an application's progress (e.g. "Passed the BMI, for neuro exam"); the applicant is notified. */
export async function addApplicationRemark(input: ApplicationRemarkInput) {
  const values = applicationRemarkSchema.parse(input);
  const { error } = await createBrowserSupabaseClient().rpc("add_application_remark", { target_application_id: values.applicationId, remark: values.remark });
  throwIfError(error);
}

/** Uploads the applicant's proof of passing the BMI; a new upload replaces the previous one. */
export async function submitBmiProof(applicationId: string, file: File) {
  const id = applicationStatusTransitionSchema.shape.applicationId.parse(applicationId);
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
    throw new Error("Upload the BMI proof as a PDF, PNG or JPEG file up to 10 MB.");
  }
  const user = await requireCurrentUser();
  const client = createBrowserSupabaseClient();
  const bucket = client.storage.from("applicant-documents");
  const objectPath = `applicants/${user.id}/${id}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error: uploadError } = await bucket.upload(objectPath, file, { contentType: file.type, upsert: false });
  throwIfError(uploadError);
  const { error } = await client.rpc("submit_bmi_proof", {
    target_application_id: id,
    submitted_document: { objectPath, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
  });
  if (error) {
    await bucket.remove([objectPath]).catch(() => undefined);
    throwIfError(error);
  }
}
