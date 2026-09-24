import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc, from }) }));

import { enrollEmployeeFace, FaceRecognitionRequestError, getMyFaceRegistration, listFaceEnrollments, recordFaceAttendance, recordMyFaceAttendance } from "./face-recognition";

const descriptor = Array.from({ length: 128 }, () => 0.1);
const scanId = "8a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const employeeId = "3f1e2d3c-4b5a-4968-8776-655443322110";

beforeEach(() => { rpc.mockReset(); from.mockReset(); });

describe("face recognition queries", () => {
  it("records attendance through the RPC with only a scan ID and descriptor", async () => {
    rpc.mockResolvedValue({ data: { scanId, outcome: "not_recognized", message: "Face not recognized.", distance: 0.8, employee: null, log: null, recordedAt: "2026-09-25T00:00:00Z" }, error: null });
    const result = await recordFaceAttendance({ scanId, descriptor });
    expect(rpc).toHaveBeenCalledWith("record_face_attendance", { target_scan_id: scanId, target_descriptor: descriptor });
    expect(result.outcome).toBe("not_recognized");
    expect(from).not.toHaveBeenCalled();
  });

  it("sends an employee self-scan to the verification RPC", async () => {
    rpc.mockResolvedValue({ data: { scanId, outcome: "time_in", message: null, distance: null, employee: { id: employeeId, employeeNumber: "PAT-001", firstName: "Ana", lastName: "One" }, log: null, recordedAt: "2026-09-25T00:00:00Z" }, error: null });
    await recordMyFaceAttendance({ scanId, descriptor });
    expect(rpc).toHaveBeenCalledWith("record_my_face_attendance", { target_scan_id: scanId, target_descriptor: descriptor });
  });

  it("reads the signed-in employee's registration status", async () => {
    rpc.mockResolvedValue({ data: { registered: false, updatedAt: null }, error: null });
    await expect(getMyFaceRegistration()).resolves.toEqual({ registered: false, updatedAt: null });
    expect(rpc).toHaveBeenCalledWith("get_my_face_registration");
  });

  it("marks transport failures as retryable and database rejections as final", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } });
    await expect(recordFaceAttendance({ scanId, descriptor })).rejects.toMatchObject({ retryable: true });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "HR access is required.", code: "42501" } });
    await expect(recordFaceAttendance({ scanId, descriptor })).rejects.toMatchObject({ retryable: false, message: "HR access is required." });
    rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(recordFaceAttendance({ scanId, descriptor })).rejects.toBeInstanceOf(FaceRecognitionRequestError);
  });

  it("validates enrollment input before calling the database", async () => {
    await expect(enrollEmployeeFace({ employeeId, descriptor, sampleCount: 5, consentConfirmed: false })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { employeeId, status: "enrolled" }, error: null });
    await enrollEmployeeFace({ employeeId, descriptor, sampleCount: 5, consentConfirmed: true });
    expect(rpc).toHaveBeenCalledWith("enroll_employee_face", { target_employee_id: employeeId, target_descriptor: descriptor, target_sample_count: 5, target_consent_confirmed: true });
  });

  it("lists enrollment metadata without descriptors", async () => {
    rpc.mockResolvedValue({ data: [{ employee_id: employeeId, sample_count: 5, enrolled_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:00:00Z" }], error: null });
    const rows = await listFaceEnrollments();
    expect(rows[0]).not.toHaveProperty("descriptor");
    expect(from).not.toHaveBeenCalled();
  });
});
