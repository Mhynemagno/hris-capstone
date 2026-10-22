import { createClient } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { ApplicantEducation, ApplicantEducationLevel, ApplicantProfileDocumentKind, ApplicationStatusHistory, HrRegisteredApplicant } from "@/lib/types/database";
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

/** HR reads the applicant's submitted education while reviewing an application. */
export async function listApplicantEducationFor(applicantId: string) {
  const { data, error } = await createBrowserSupabaseClient().from("applicant_education").select("*").eq("applicant_id", applicantId).order("level");
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

/** HR reactivates a deactivated applicant account so the applicant can sign in and resubmit. */
export async function reactivateApplicantAccount(userId: string) {
  const { error } = await createBrowserSupabaseClient().rpc("reactivate_applicant_account", { target_user_id: userId });
  throwIfError(error);
}

/**
 * HR issues new credentials: Supabase Auth emails the applicant a password-reset link that opens the
 * existing /reset-password page. A non-persisting client sends it, so no PKCE verifier is left in HR's
 * browser; the recovery email template (supabase/templates/recovery.html) uses a token_hash link that
 * /auth/callback verifies in the applicant's own browser.
 */
export async function sendApplicantCredentials(email: string) {
  const { url, publishableKey } = getPublicSupabaseConfig();
  const client = createClient(url, publishableKey, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", "/reset-password");
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
  if (error) throw new Error("We could not send new credentials. Please try again.");
}

/** HR reopens a Not Selected application so the applicant can resubmit documents for review. */
export async function reopenApplicationForResubmission(applicationId: string, note?: string) {
  const { error } = await createBrowserSupabaseClient().rpc("reopen_application_for_resubmission", { target_application_id: applicationId, target_note: note?.trim() || null });
  throwIfError(error);
}

/** The applicant's own application history (RLS limits it to their applications), oldest first. */
export async function listMyApplicationHistory(applicationId: string) {
  const { data, error } = await createBrowserSupabaseClient()
    .from("application_status_history")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at");
  throwIfError(error);
  return (data ?? []) as ApplicationStatusHistory[];
}
