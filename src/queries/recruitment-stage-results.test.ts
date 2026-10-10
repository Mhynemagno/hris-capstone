import { beforeEach, describe, expect, it, vi } from "vitest";

const applicationId = "223e4567-e89b-42d3-a456-426614174000";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), bucket: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
    storage: { from: (bucket: string) => { mocks.bucket(bucket); return { upload: mocks.upload, remove: mocks.remove }; } },
  }),
}));

import { listAllHrApplications, recordStageResult } from "./recruitment";

describe("recordStageResult", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.upload.mockReset();
    mocks.remove.mockReset();
    mocks.bucket.mockReset();
  });

  it("records a result without a document", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await recordStageResult({ applicationId, result: "scheduled", note: "Monday 8 AM" });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("record_stage_result", { target_application_id: applicationId, target_result: "scheduled", target_note: "Monday 8 AM", target_document: null });
  });

  it("uploads the supporting document under the application, then records the result with it", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
    const file = new File(["%PDF"], "Agility result.pdf", { type: "application/pdf" });
    await recordStageResult({ applicationId, result: "passed", file });
    expect(mocks.bucket).toHaveBeenCalledWith("recruitment-stage-documents");
    const path = mocks.upload.mock.calls[0]![0] as string;
    expect(path).toMatch(new RegExp(`^applications/${applicationId}/[0-9a-f-]{36}\.pdf$`));
    expect(mocks.rpc).toHaveBeenCalledWith("record_stage_result", expect.objectContaining({
      target_result: "passed",
      target_document: { objectPath: path, fileName: "Agility result.pdf", mimeType: "application/pdf", sizeBytes: 4 },
    }));
  });

  it("removes the uploaded file when the result cannot be recorded", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: { message: "This application is no longer in the recruitment process." } });
    const file = new File(["%PDF"], "result.pdf", { type: "application/pdf" });
    await expect(recordStageResult({ applicationId, result: "failed", file })).rejects.toThrow("This application is no longer in the recruitment process.");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0]![0]]);
  });

  it("rejects files that are not a PDF or image, or larger than 10 MB", async () => {
    await expect(recordStageResult({ applicationId, result: "passed", file: new File(["x"], "notes.docx", { type: "application/msword" }) })).rejects.toThrow("Use a PDF, PNG, JPEG, or WebP file up to 10 MB.");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

describe("listAllHrApplications", () => {
  it("adds each application's stage result for the Status column", async () => {
    mocks.rpc.mockReturnValue({ range: vi.fn().mockResolvedValue({ data: [{ application_id: applicationId, applicant_id: "a1", job_opening_id: 3, application_status: "Drug Test", submitted_at: "2026-10-01T00:00:00Z", ai_score_id: null, ai_score_status: null, ai_score: null, ai_explanation: null, ai_model: null }], error: null }) });
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({ in: vi.fn().mockResolvedValue({ data: table === "applications" ? [{ id: applicationId, stage_result: "scheduled" }] : [], error: null }) }),
    }));
    const rows = await listAllHrApplications();
    expect(rows[0]).toMatchObject({ id: applicationId, status: "Drug Test", stage_result: "scheduled" });
  });
});
