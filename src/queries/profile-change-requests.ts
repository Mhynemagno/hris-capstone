import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { PaginatedResult, ProfileChangeRequest } from "@/lib/types/database";
import {
  profileChangeCancellationSchema,
  profileChangeDecisionSchema,
  profileChangeDraftSchema,
  profileChangeRequestFiltersSchema,
  profileChangeSubmissionSchema,
  type ProfileChangeRequestFilters,
} from "@/schemas/profile-change-requests";
import { uuidSchema } from "@/schemas/common";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }

export async function listMyProfileChangeRequests(input: Partial<ProfileChangeRequestFilters> = {}): Promise<PaginatedResult<ProfileChangeRequest, ProfileChangeRequestFilters>> {
  const filters = profileChangeRequestFiltersSchema.parse(input); const from = (filters.page - 1) * filters.pageSize;
  let query = createBrowserSupabaseClient().from("profile_change_requests").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error, count } = await query; throwIfError(error); return { rows: (data ?? []) as ProfileChangeRequest[], count: count ?? 0, filters };
}

export async function listAdminProfileChangeRequests(input: Partial<ProfileChangeRequestFilters> = {}) { return listMyProfileChangeRequests(input); }

export async function getProfileChangeRequest(requestId: string) {
  const id = uuidSchema.parse(requestId);
  const { data, error } = await createBrowserSupabaseClient().from("profile_change_requests").select("*, profile_change_request_changes(*), profile_change_request_documents(*), profile_change_request_history(*)").eq("id", id).maybeSingle();
  throwIfError(error); return data;
}

export async function getProfileChangeDocumentUrl(objectPath: string) {
  if (!/^profile-change-requests\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png|jpe?g|webp)$/i.test(objectPath)) {
    throw new Error("Invalid profile-change request document path.");
  }
  const { data, error } = await createBrowserSupabaseClient().storage.from("private-documents").createSignedUrl(objectPath, 60);
  throwIfError(error);
  if (!data?.signedUrl) throw new Error("Unable to open the supporting document.");
  return data.signedUrl;
}

const extensionFor = (file: File) => ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type] ?? "");

export async function submitProfileChangeRequest(draftWithRequestId: { requestId: string; note?: string; changes: unknown[] }, files: File[]) {
  const draft = profileChangeDraftSchema.parse({ note: draftWithRequestId.note, changes: draftWithRequestId.changes });
  const requestId = uuidSchema.parse(draftWithRequestId.requestId);
  const client = createBrowserSupabaseClient(); const { data: userData, error: userError } = await client.auth.getUser(); throwIfError(userError);
  if (!userData.user) throw new Error("Authentication is required.");
  const bucket = client.storage.from("private-documents");
  const documents = [] as Array<{ objectPath: string; fileName: string; mimeType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp"; sizeBytes: number }>;
  if (files.length > 10) throw new Error("Attach at most 10 supporting documents.");
  try {
    for (const file of files) {
      const extension = extensionFor(file); if (!extension || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Supporting documents must be PDF, PNG, JPEG, or WEBP files up to 10 MiB.");
      const objectPath = `profile-change-requests/${userData.user.id}/${requestId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(objectPath, file, { contentType: file.type, upsert: false }); throwIfError(error);
      documents.push({ objectPath, fileName: file.name, mimeType: file.type as "application/pdf" | "image/png" | "image/jpeg" | "image/webp", sizeBytes: file.size });
    }
    const payload = profileChangeSubmissionSchema.parse({ ...draft, requestId, documents });
    const { error } = await client.rpc("submit_profile_change_request", { target_request_id: payload.requestId, request_note: payload.note ?? null, requested_changes: payload.changes, requested_documents: payload.documents }); throwIfError(error);
  } catch (error) {
    if (documents.length > 0) {
      await bucket.remove(documents.map((document) => document.objectPath)).catch(() => undefined);
    }
    throw error;
  }
}

export async function cancelProfileChangeRequest(input: { requestId: string }) { const parsed = profileChangeCancellationSchema.parse(input); const { error } = await createBrowserSupabaseClient().rpc("cancel_profile_change_request", { target_request_id: parsed.requestId }); throwIfError(error); }
export async function decideProfileChangeRequest(input: { requestId: string; decision: "approved" | "rejected"; reason?: string }) { const parsed = profileChangeDecisionSchema.parse(input); const { error } = await createBrowserSupabaseClient().rpc("decide_profile_change_request", { target_request_id: parsed.requestId, requested_decision: parsed.decision, requested_reason: parsed.reason ?? null }); throwIfError(error); }
