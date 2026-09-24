import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { uuidSchema } from "@/schemas/common";
import { faceAttendanceResultSchema, faceAttendanceScanSchema, faceEnrollmentSchema, faceEnrollmentSummarySchema } from "@/schemas/face-recognition";

/**
 * Face-recognition RPCs. None of them returns a stored descriptor: enrollment summaries omit
 * it and matching happens inside the database.
 */
export class FaceRecognitionRequestError extends Error {
  /** True when the request may not have reached the database (safe to retry with the same scan ID). */
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "FaceRecognitionRequestError";
    this.retryable = retryable;
  }
}

function toRequestError(error: { message: string; code?: string }) {
  // PostgREST/Postgres errors carry a SQLSTATE code; transport failures do not.
  return new FaceRecognitionRequestError(error.code ? error.message : "Unable to reach the attendance service. Check the connection.", !error.code);
}

export async function listFaceEnrollments() {
  const { data, error } = await createBrowserSupabaseClient().rpc("list_face_enrollments");
  if (error) throw toRequestError(error);
  return faceEnrollmentSummarySchema.array().parse(data ?? []);
}

export async function enrollEmployeeFace(input: unknown) {
  const values = faceEnrollmentSchema.parse(input);
  const { data, error } = await createBrowserSupabaseClient().rpc("enroll_employee_face", {
    target_employee_id: values.employeeId,
    target_descriptor: values.descriptor,
    target_sample_count: values.sampleCount,
    target_consent_confirmed: values.consentConfirmed,
  });
  if (error) throw toRequestError(error);
  return data as { employeeId: string; status: "enrolled" | "re_registered" };
}

export async function deleteFaceEnrollment(employeeId: string) {
  const { error } = await createBrowserSupabaseClient().rpc("delete_employee_face_enrollment", { target_employee_id: uuidSchema.parse(employeeId) });
  if (error) throw toRequestError(error);
}

export async function recordFaceAttendance(input: unknown) {
  const values = faceAttendanceScanSchema.parse(input);
  let response;
  try {
    response = await createBrowserSupabaseClient().rpc("record_face_attendance", { target_scan_id: values.scanId, target_descriptor: values.descriptor });
  } catch {
    throw new FaceRecognitionRequestError("Unable to reach the attendance service. Check the connection.", true);
  }
  if (response.error) throw toRequestError(response.error);
  return faceAttendanceResultSchema.parse(response.data);
}
