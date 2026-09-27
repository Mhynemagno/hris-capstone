import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ApplicantEducation, ApplicantEducationLevel, ApplicantProfileDocumentKind, HrRegisteredApplicant } from "@/lib/types/database";
import { APPLICANT_EDUCATION_LEVELS, applicantEducationSchema, type ApplicantEducationInput } from "@/schemas/applicant-portal";

const applicantProfileDocumentBucket = "applicant-profile-documents";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getMyAccountEmail() {
  const { data, error } = await createBrowserSupabaseClient().auth.getUser();
  throwIfError(error);
  return data.user?.email ?? null;
}

export async function listMyApplicantEducation() {
  const { data, error } = await createBrowserSupabaseClient().from("applicant_education").select("*").order("level");
  throwIfError(error);
  return (data ?? []) as ApplicantEducation[];
}

/** Saves one row per education level; a level left completely blank is removed. */
export async function saveMyApplicantEducation(applicantId: string, input: ApplicantEducationInput) {
  const values = applicantEducationSchema.parse(input);
  const client = createBrowserSupabaseClient();
  const { data: existing, error: existingError } = await client.from("applicant_education").select("id, level").eq("applicant_id", applicantId);
  throwIfError(existingError);
  const existingByLevel = new Map(((existing ?? []) as Pick<ApplicantEducation, "id" | "level">[]).map((row) => [row.level, row.id]));
  for (const { level } of APPLICANT_EDUCATION_LEVELS) {
    const entry = values[level];
    const row = { school_name: entry.schoolName ?? null, degree_course: entry.degreeCourse ?? null, year_graduated: entry.yearGraduated ?? null, location: entry.location ?? null };
    const existingId = existingByLevel.get(level as ApplicantEducationLevel);
    const blank = !row.school_name && !row.degree_course && row.year_graduated === null && !row.location;
    if (blank) {
      if (existingId) throwIfError((await client.from("applicant_education").delete().eq("id", existingId)).error);
    } else if (existingId) {
      throwIfError((await client.from("applicant_education").update(row).eq("id", existingId)).error);
    } else {
      throwIfError((await client.from("applicant_education").insert({ applicant_id: applicantId, level, ...row })).error);
    }
  }
}

/** Removes one required profile document; the database refuses while an application is being decided. */
export async function removeMyApplicantProfileDocument(kind: ApplicantProfileDocumentKind) {
  const client = createBrowserSupabaseClient();
  const { data, error } = await client.rpc("remove_my_applicant_profile_document", { target_kind: kind });
  throwIfError(error);
  if (typeof data !== "string") return { cleanupError: null };
  const { error: cleanupError } = await client.storage.from(applicantProfileDocumentBucket).remove([data]);
  return { cleanupError: cleanupError?.message ?? null };
}

export async function listHrRegisteredApplicants() {
  const { data, error } = await createBrowserSupabaseClient().rpc("list_hr_registered_applicants");
  throwIfError(error);
  return ((data ?? []) as HrRegisteredApplicant[]).map((row) => ({ ...row, application_count: Number(row.application_count ?? 0) }));
}
