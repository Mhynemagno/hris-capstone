import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const applicationId = "223e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  }),
}));

import * as recruitmentQueries from "./recruitment";

import { getPublishedJob, retryApplicationAnalysis, saveJobOpening, submitApplication } from "./recruitment";

describe("getPublishedJob", () => {
  beforeEach(() => vi.resetAllMocks());

  it("applies an explicit published-status filter before returning a public job", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    mocks.from.mockReturnValue(query);

    await getPublishedJob(42);

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", 42);
    expect(query.eq).toHaveBeenNthCalledWith(2, "status", "published");
  });
});

describe("submitApplication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: applicationId, error: null });
  });

  it("stops before upload when the signed-in account has no applicant profile", async () => {
    const profileQuery = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    mocks.from.mockReturnValue(profileQuery);

    await expect(submitApplication({
      applicationId,
      jobId: 7,
      coverNote: "Ready to contribute.",
      documents: [{ kind: "cv", file: new File(["CV"], "cv.pdf", { type: "application/pdf" }) }],
    })).rejects.toMatchObject({ code: "APPLICANT_PROFILE_REQUIRED" });

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads after confirming the signed-in account has an applicant profile", async () => {
    const profileQuery = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "323e4567-e89b-42d3-a456-426614174000" }, error: null }),
      select: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    mocks.from.mockReturnValue(profileQuery);

    await expect(submitApplication({
      applicationId,
      jobId: 7,
      coverNote: "Ready to contribute.",
      documents: [{ kind: "cv", file: new File(["CV"], "cv.pdf", { type: "application/pdf" }) }],
    })).resolves.toBe(applicationId);

    expect(profileQuery.select).toHaveBeenCalledWith("id");
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("submit_application", expect.objectContaining({
      target_application_id: applicationId,
      target_job_opening_id: 7,
    }));
  });

  it("rejects a Word document before uploading it", async () => {
    const profileQuery = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "323e4567-e89b-42d3-a456-426614174000" }, error: null }),
      select: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    mocks.from.mockReturnValue(profileQuery);

    await expect(submitApplication({
      applicationId,
      jobId: 7,
      coverNote: "Ready to contribute.",
      documents: [{ kind: "cv", file: new File(["CV"], "cv.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) }],
    })).rejects.toThrow("Choose a PDF, PNG, or JPEG file.");

    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("removes uploaded objects when the submission transaction fails", async () => {
    const profileQuery = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "323e4567-e89b-42d3-a456-426614174000" }, error: null }),
      select: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    mocks.from.mockReturnValue(profileQuery);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "submission failed" } });
    mocks.remove.mockResolvedValue({ error: null });

    await expect(submitApplication({
      applicationId,
      jobId: 7,
      coverNote: "Ready to contribute.",
      documents: [{ kind: "cv", file: new File(["CV"], "cv.pdf", { type: "application/pdf" }) }],
    })).rejects.toThrow("submission failed");

    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp(`^applicants/${userId}/${applicationId}/.+\\.pdf$`)),
    ]);
  });
});

describe("saveJobOpening", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rpc.mockResolvedValue({ data: { id: 42 }, error: null });
  });

  it("saves the opening and its criteria through one transactional RPC", async () => {
    await expect(saveJobOpening({
      departmentId: 1,
      positionId: 2,
      title: "Public Safety Analyst",
      description: "Analyze public safety data and support evidence-based operational decisions.",
      status: "draft",
      criteria: [{ ordinal: 1, kind: "skill", requirement: "Clear written communication", isRequired: true }],
    }, 42)).resolves.toMatchObject({ id: 42 });

    expect(mocks.rpc).toHaveBeenCalledWith("save_job_opening", expect.objectContaining({
      target_job_id: 42,
      requested_criteria: [{ ordinal: 1, kind: "skill", requirement: "Clear written communication", isRequired: true }],
    }));
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("retryApplicationAnalysis", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("asks the database to queue a fresh analysis attempt", async () => {
    const scoreId = "323e4567-e89b-42d3-a456-426614174000";
    mocks.rpc.mockResolvedValue({ data: scoreId, error: null });

    await expect(retryApplicationAnalysis(applicationId)).resolves.toBe(scoreId);

    expect(mocks.rpc).toHaveBeenCalledWith("retry_application_analysis", {
      target_application_id: applicationId,
    });
  });
});

describe("applicant profile media", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("uploads a replacement photo before changing its database path and cleaning up the old file", async () => {
    const queries = recruitmentQueries as typeof recruitmentQueries & {
      replaceMyApplicantProfilePhoto: (applicant: { id: string; profile_image_path: string | null }, file: File) => Promise<{ path: string; cleanupError: string | null }>;
    };
    const applicant = {
      id: "323e4567-e89b-42d3-a456-426614174000",
      profile_image_path: "applicants/323e4567-e89b-42d3-a456-426614174000/423e4567-e89b-42d3-a456-426614174000.png",
    };

    expect(queries.replaceMyApplicantProfilePhoto).toBeTypeOf("function");
    await expect(queries.replaceMyApplicantProfilePhoto(applicant, new File(["photo"], "applicant.webp", { type: "image/webp" }))).resolves.toMatchObject({
      path: expect.stringMatching(/^applicants\/323e4567-e89b-42d3-a456-426614174000\//),
      cleanupError: null,
    });
    expect(mocks.upload).toHaveBeenCalledBefore(mocks.rpc);
    expect(mocks.rpc).toHaveBeenCalledBefore(mocks.remove);
    expect(mocks.remove).toHaveBeenCalledWith([applicant.profile_image_path]);
  });

  it("uploads each required profile document before recording it through the scoped RPC", async () => {
    const queries = recruitmentQueries as typeof recruitmentQueries & {
      saveApplicantProfileDocuments: (documents: Array<{ kind: "eligibility" | "diploma"; file: File }>) => Promise<void>;
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    expect(queries.saveApplicantProfileDocuments).toBeTypeOf("function");
    await expect(queries.saveApplicantProfileDocuments([
      { kind: "eligibility", file: new File(["proof"], "eligibility.pdf", { type: "application/pdf" }) },
    ])).resolves.toBeUndefined();

    expect(mocks.upload).toHaveBeenCalledBefore(mocks.rpc);
    expect(mocks.rpc).toHaveBeenCalledWith("save_my_applicant_profile_document", expect.objectContaining({
      target_kind: "eligibility",
      target_file_name: "eligibility.pdf",
      target_mime_type: "application/pdf",
    }));
  });
});
