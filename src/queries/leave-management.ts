import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { LeaveBalance, LeaveRequest, LeaveRequestAttachment, LeaveRequestWithEmployee, LeaveType, PaginatedResult } from "@/lib/types/database";
import { leaveAttachmentSchema, leaveCancellationSchema, leaveDecisionSchema, leaveRequestDraftSchema, leaveRequestFiltersSchema, leaveRequestSubmissionSchema, leaveTypeAllotmentSchema, leaveTypeFiltersSchema, leaveTypeSchema, leaveTypeUpdateSchema, type LeaveRequestFilters, type LeaveTypeFilters } from "@/schemas/leave-management";
import { uuidSchema } from "@/schemas/common";

function throwIfError(error: { message: string } | null) { if (error) throw new Error(error.message); }
export function leaveRequestFilters(input: unknown = {}) { return leaveRequestFiltersSchema.parse(input); }
export function leaveTypeFilters(input: unknown = {}) { return leaveTypeFiltersSchema.parse(input); }

/** Every leave type the caller can see (HR sees inactive types too); for the admin leave-type list. */
export async function listLeaveTypes(input: Partial<LeaveTypeFilters> = {}): Promise<PaginatedResult<LeaveType, LeaveTypeFilters>> { const filters=leaveTypeFilters(input); const from=(filters.page-1)*filters.pageSize; const { data, error, count }=await createBrowserSupabaseClient().from("leave_types").select("*",{count:"exact"}).order("name").range(from,from+filters.pageSize-1); throwIfError(error); return { rows:(data??[]) as LeaveType[], count:count??0, filters }; }
/** Only leave types that can currently be requested (submit_leave_request rejects inactive types). */
export async function listActiveLeaveTypes() { const { data, error } = await createBrowserSupabaseClient().from("leave_types").select("*").eq("is_active", true).order("name"); throwIfError(error); return (data ?? []) as LeaveType[]; }
export async function listMyLeaveRequests(input: Partial<LeaveRequestFilters> = {}): Promise<PaginatedResult<LeaveRequest, LeaveRequestFilters>> { const filters = leaveRequestFilters(input); const from=(filters.page-1)*filters.pageSize; let query=createBrowserSupabaseClient().from("leave_requests").select("*",{count:"exact"}).order("created_at",{ascending:false}).range(from,from+filters.pageSize-1); if(filters.status) query=query.eq("status",filters.status); const {data,error,count}=await query; throwIfError(error); return {rows:(data??[]) as LeaveRequest[],count:count??0,filters}; }
const employeeEmbed = "employees(first_name, middle_name, last_name, employee_number)";
/** HR queue: every leave request with the submitting employee's name and badge number. */
export async function listHrLeaveRequests(input: Partial<LeaveRequestFilters> = {}): Promise<PaginatedResult<LeaveRequestWithEmployee, LeaveRequestFilters>> { const filters = leaveRequestFilters(input); const from=(filters.page-1)*filters.pageSize; let query=createBrowserSupabaseClient().from("leave_requests").select(`*, ${employeeEmbed}`,{count:"exact"}).order("created_at",{ascending:false}).range(from,from+filters.pageSize-1); if(filters.status) query=query.eq("status",filters.status); const {data,error,count}=await query; throwIfError(error); return {rows:(data??[]) as LeaveRequestWithEmployee[],count:count??0,filters}; }
export async function getLeaveRequest(requestId: string) { const id=uuidSchema.parse(requestId); const {data,error}=await createBrowserSupabaseClient().from("leave_requests").select(`*, ${employeeEmbed}, leave_request_attachments(*), leave_request_history(*)`).eq("id",id).maybeSingle(); throwIfError(error); return data as (LeaveRequestWithEmployee & { leave_request_attachments: LeaveRequestAttachment[]; leave_request_history: unknown[] }) | null; }
export async function getLeaveAttachmentUrl(objectPath:string) { const path=leaveAttachmentSchema.pick({objectPath:true}).parse({objectPath}).objectPath; const {data,error}=await createBrowserSupabaseClient().storage.from("private-documents").createSignedUrl(path,60); throwIfError(error); if(!data?.signedUrl) throw new Error("Unable to open the supporting document."); return data.signedUrl; }
const extensionFor=(file:File)=>({"application/pdf":"pdf","image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[file.type]??"");
export async function submitLeaveRequest(draft: unknown, files: File[]) {
  const draftRecord = draft as Record<string, unknown>;
  const initial = {
    ...leaveRequestDraftSchema.parse(draft),
    requestId: uuidSchema.parse(draftRecord.requestId),
  };
  if (files.length > 10) throw new Error("Attach at most 10 supporting documents.");
  const client = createBrowserSupabaseClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  if (!userData.user) throw new Error("Authentication is required.");

  const bucket = client.storage.from("private-documents");
  const attachments = [] as Array<{ objectPath: string; fileName: string; mimeType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp"; sizeBytes: number }>;
  try {
    for (const file of files) {
      const extension = extensionFor(file);
      if (!extension || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Supporting documents must be PDF, PNG, JPEG, or WEBP files up to 10 MiB.");
      const objectPath = `leave-requests/${userData.user.id}/${initial.requestId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await bucket.upload(objectPath, file, { contentType: file.type, upsert: false });
      throwIfError(error);
      attachments.push({ objectPath, fileName: file.name, mimeType: file.type as typeof attachments[number]["mimeType"], sizeBytes: file.size });
    }
    const payload = leaveRequestSubmissionSchema.parse({ ...initial, attachments });
    const { error } = await client.rpc("submit_leave_request", { target_request_id: payload.requestId, target_leave_type_id: payload.leaveTypeId, target_starts_on: payload.startsOn, target_ends_on: payload.endsOn, request_reason: payload.reason ?? null, requested_attachments: payload.attachments });
    throwIfError(error);
  } catch (error) {
    if (attachments.length > 0) {
      await bucket.remove(attachments.map((attachment) => attachment.objectPath)).catch(() => undefined);
    }
    throw error;
  }
}
export async function cancelLeaveRequest(input:unknown){const parsed=leaveCancellationSchema.parse(input);const{error}=await createBrowserSupabaseClient().rpc("cancel_leave_request",{target_request_id:parsed.requestId});throwIfError(error);}
export async function decideLeaveRequest(input:unknown){const parsed=leaveDecisionSchema.parse(input);const{error}=await createBrowserSupabaseClient().rpc("decide_leave_request",{target_request_id:parsed.requestId,requested_decision:parsed.decision,requested_note:parsed.note??null});throwIfError(error);}
export async function createLeaveType(input:unknown){const parsed=leaveTypeSchema.parse(input);const{error}=await createBrowserSupabaseClient().rpc("create_leave_type",{type_name:parsed.name,type_description:parsed.description??null,type_requires_attachment:parsed.requiresAttachment});throwIfError(error);}
export async function updateLeaveType(input:unknown){const parsed=leaveTypeUpdateSchema.parse(input);const{error}=await createBrowserSupabaseClient().rpc("update_leave_type",{target_type_id:parsed.id,type_name:parsed.name,type_description:parsed.description??null,type_requires_attachment:parsed.requiresAttachment,type_is_active:parsed.isActive});throwIfError(error);}
/** Sets a leave type's yearly allotment; null days means no limit. */
export async function setLeaveTypeAllotment(input:unknown){const parsed=leaveTypeAllotmentSchema.parse(input);const{error}=await createBrowserSupabaseClient().rpc("set_leave_type_allotment",{target_type_id:parsed.id,type_days_per_year:parsed.daysPerYear,type_excess_deducted:parsed.excessDeductedFromRetirement});throwIfError(error);}
/** The caller's used days per active leave type in a calendar year. */
export async function getMyLeaveBalances(year:number){const{data,error}=await createBrowserSupabaseClient().rpc("get_my_leave_balances",{target_year:year});throwIfError(error);return (data??[]) as LeaveBalance[];}
