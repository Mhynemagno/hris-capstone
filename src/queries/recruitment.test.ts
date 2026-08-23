import { beforeEach, describe, expect, it, vi } from "vitest";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174001";

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getUser: mocks.authGetUser },
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  }),
}));

import * as queries from "./index";

describe("recruitment queries", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uploads an applicant-owned CV before submitting normalized metadata", async () => {
    const recruitment = queries as typeof queries & {
      submitApplication: (input: {
        applicationId: string;
        jobId: number;
        coverNote?: string;
        documents: Array<{ kind: "cv" | "credential"; file: File }>;
      }) => Promise<string>;
    };
    const upload = vi.fn().mockResolvedValue({ error: null });
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.storageFrom.mockReturnValue({ upload });
    mocks.rpc.mockResolvedValue({ data: applicationId, error: null });
    const file = new File(["resume"], "resume.pdf", { type: "application/pdf" });

    expect(recruitment.submitApplication).toBeDefined();
    await expect(recruitment.submitApplication({
      applicationId,
      jobId: 7,
      coverNote: " Ready to contribute. ",
      documents: [{ kind: "cv", file }],
    })).resolves.toBe(applicationId);

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^applicants/${userId}/${applicationId}/`)),
      file,
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("submit_application", expect.objectContaining({
      target_application_id: applicationId,
      target_job_opening_id: 7,
      submitted_cover_note: "Ready to contribute.",
      submitted_documents: [expect.objectContaining({ kind: "cv", fileName: "resume.pdf", mimeType: "application/pdf" })],
    }));
  });

  it("sends a validated hiring decision through the atomic hiring RPC", async () => {
    const recruitment = queries as typeof queries & {
      hireApplication: (input: {
        applicationId: string;
        employeeNumber: string;
        departmentId: number;
        positionId: number;
        employmentStartedOn: string;
        note?: string;
      }) => Promise<string>;
    };
    mocks.rpc.mockResolvedValue({ data: "123e4567-e89b-42d3-a456-426614174099", error: null });

    expect(recruitment.hireApplication).toBeDefined();
    await expect(recruitment.hireApplication({
      applicationId,
      employeeNumber: "EMP-2026-001",
      departmentId: 3,
      positionId: 4,
      employmentStartedOn: "2026-10-15",
      note: " Final interview complete. ",
    })).resolves.toBe("123e4567-e89b-42d3-a456-426614174099");

    expect(mocks.rpc).toHaveBeenCalledWith("hire_application", {
      target_application_id: applicationId,
      target_employee_number: "EMP-2026-001",
      target_department_id: 3,
      target_position_id: 4,
      target_employment_started_on: "2026-10-15",
      decision_note: "Final interview complete.",
    });
  });

  it("creates a short-lived URL only for an applicant document path", async () => {
    const recruitment = queries as typeof queries & {
      getApplicantDocumentUrl: (path: string) => Promise<string | null>;
    };
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.test/cv" }, error: null });
    mocks.storageFrom.mockReturnValue({ createSignedUrl });
    const path = `applicants/${userId}/${applicationId}/123e4567-e89b-42d3-a456-426614174002.pdf`;

    expect(recruitment.getApplicantDocumentUrl).toBeDefined();
    await expect(recruitment.getApplicantDocumentUrl(path)).resolves.toBe("https://example.test/cv");
    expect(createSignedUrl).toHaveBeenCalledWith(path, 60);
    await expect(recruitment.getApplicantDocumentUrl("unowned.pdf")).rejects.toThrow("Invalid applicant document path");
  });
});
