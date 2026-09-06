import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  applicantDocumentSchema,
  applicantProfileDocumentFileSchema,
  applicantProfilePhotoFileSchema,
  applicantProfileSchema,
  applicationAiFiltersSchema,
  applicationFiltersSchema,
  applicationStatusTransitionSchema,
  applicationSubmissionSchema,
  hiringDecisionSchema,
  jobFiltersSchema,
  jobOpeningSchema,
  type ApplicationSubmissionInput,
  type ApplicantProfileDocumentFile,
  type ApplicantProfileInput,
  type ApplicationAiFilters,
  type ApplicationFilters,
  type ApplicationStatusTransitionInput,
  type HiringDecisionInput,
  type JobFilters,
  type JobOpeningInput,
} from "@/schemas/recruitment";
import type { Applicant, ApplicantProfileDocument, Application, ApplicationAiScore, ApplicantDocument, ApplicationStatusHistory, HrShortlistApplication, JobOpening, JobQualificationCriterion, PaginatedResult } from "@/lib/types/database";

type PendingApplicantDocument = {
  kind: "cv" | "credential";
  file: File;
};

type PendingApplicantProfileDocument = {
  kind: "eligibility" | "diploma";
  file: ApplicantProfileDocumentFile;
};

type SubmitApplicationInput = Omit<ApplicationSubmissionInput, "documents"> & {
  documents: PendingApplicantDocument[];
};

type ResubmitApplicationInput = {
  applicationId: string;
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

const applicantProfilePhotoBucket = "applicant-profile-photos";
const applicantProfileDocumentBucket = "applicant-profile-documents";
const applicantProfilePhotoExtensions = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

const applicantProfileDocumentExtensions = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;

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
    sex: values.sex ?? null,
    civil_status: values.civilStatus ?? null,
    religion: values.religion ?? null,
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

export async function getApplicantProfileDocumentUrl(objectPath: string) {
  const { data, error } = await createBrowserSupabaseClient().storage.from(applicantProfileDocumentBucket).createSignedUrl(objectPath, 600);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error("Unable to prepare the profile document.");
  return data.signedUrl;
}

export async function saveApplicantProfileDocuments(documents: PendingApplicantProfileDocument[]) {
  const user = await requireCurrentUser();
  const client = createBrowserSupabaseClient();
  const bucket = client.storage.from(applicantProfileDocumentBucket);
  const uploadedPaths: string[] = [];
  try {
    for (const document of documents) {
      const file = applicantProfileDocumentFileSchema.parse(document.file);
      const extension = applicantProfileDocumentExtensions[file.type as keyof typeof applicantProfileDocumentExtensions];
      const objectPath = `applicant-profiles/${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await bucket.upload(objectPath, file, { contentType: file.type, upsert: false });
      throwIfError(uploadError);
      uploadedPaths.push(objectPath);
      const { error: saveError } = await client.rpc("save_my_applicant_profile_document", {
        target_kind: document.kind,
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
  let query = createBrowserSupabaseClient().from("job_openings").select("*, job_qualification_criteria(*), applications(count)", { count: "exact" }).order("updated_at", { ascending: false });
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error, count } = await query.range(from, to);
  throwIfError(error);
  return { rows: (data ?? []) as Array<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }>, count: count ?? 0, filters } satisfies PaginatedResult<JobOpening & { job_qualification_criteria: JobQualificationCriterion[] }, JobFilters>;
}

export async function saveJobOpening(input: JobOpeningInput, jobId?: number) {
  const values = jobOpeningSchema.parse(input);
  await requireCurrentUser();
  const client = createBrowserSupabaseClient();
  const { data, error } = await client.rpc("save_job_opening", {
    target_job_id: jobId ?? null,
    target_department_id: values.departmentId,
    target_position_id: values.positionId,
    target_title: values.title,
    target_description: values.description,
    target_location: values.location ?? null,
    target_closes_on: values.closesOn ?? null,
    target_status: values.status,
    requested_criteria: values.criteria,
  });
  throwIfError(error);
  return data as JobOpening;
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
    throwIfError(error);
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

export type { PendingApplicantDocument, PendingApplicantProfileDocument, ResubmitApplicationInput, SubmitApplicationInput };
