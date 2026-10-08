import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const applicationId = "223e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, download: mocks.download }) },
  }),
}));

import * as recruitmentQueries from "./recruitment";

import { getPublishedJob, loadMyProfileDocumentFile, retryApplicationAnalysis, saveApplicantProfile, saveJobOpening, SESSION_ENDED_MESSAGE, submitApplication } from "./recruitment";

/** The Patrolman / Patrolwoman rank lookup every job-opening save makes. */
function mockPatrolRank(id: number | null = 1) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: id === null ? null : { id }, error: null }) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  return query;
}

/** What supabase-js returns from auth.getUser() when the browser's session is gone or was revoked. */
const sessionMissing = Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError", status: 400 });

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

  it("classifies missing eligibility and diploma records as a profile requirement", async () => {
    const profileQuery = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "323e4567-e89b-42d3-a456-426614174000" }, error: null }),
      select: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    mocks.from.mockReturnValue(profileQuery);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Upload your eligibility and diploma documents before applying." } });
    mocks.remove.mockResolvedValue({ error: null });

    await expect(submitApplication({
      applicationId,
      jobId: 7,
      coverNote: "Ready to contribute.",
      documents: [{ kind: "cv", file: new File(["CV"], "cv.pdf", { type: "application/pdf" }) }],
    })).rejects.toMatchObject({
      code: "APPLICANT_PROFILE_REQUIRED",
      message: expect.stringContaining("Documents page"),
    });
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

  it("does not depend on auth.getUser(), which reports a revoked session as \"Auth session missing!\"", async () => {
    mockPatrolRank();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: sessionMissing });

    await expect(saveJobOpening({
      title: "Patrolman",
      description: "Serve the community through visible patrol work and outreach.",
      location: "San Juan City Police Station",
      closesOn: "2026-10-31",
      status: "published",
      criteria: [{ ordinal: 1, kind: "education", requirement: "Baccalaureate Degree", isRequired: true }],
    })).resolves.toMatchObject({ id: 42 });

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("save_job_opening", expect.objectContaining({ target_status: "published" }));
  });

  it("saves the opening, its criteria and the Patrolman / Patrolwoman rank through one transactional RPC", async () => {
    const rankQuery = mockPatrolRank(7);
    await expect(saveJobOpening({
      title: "Public Safety Analyst",
      description: "Analyze public safety data and support evidence-based operational decisions.",
      location: "San Juan City Police Station",
      closesOn: "2026-10-31",
      status: "draft",
      criteria: [{ ordinal: 1, kind: "skill", requirement: "Clear written communication", isRequired: true }],
    }, 42)).resolves.toMatchObject({ id: 42 });

    expect(mocks.rpc).toHaveBeenCalledWith("save_job_opening", expect.objectContaining({
      target_job_id: 42,
      target_department_id: null,
      target_rank_id: 7,
      target_location: "San Juan City Police Station",
      target_closes_on: "2026-10-31",
      requested_criteria: [{ ordinal: 1, kind: "skill", requirement: "Clear written communication", isRequired: true }],
    }));
    expect(mocks.from).toHaveBeenCalledWith("ranks");
    expect(rankQuery.eq).toHaveBeenCalledWith("code", "PAT");
  });
});

describe("saveJobOpening with an image", () => {
  const values = {
    title: "Public Safety Analyst",
    description: "Analyze public safety data and support evidence-based operational decisions.",
    location: "San Juan City Police Station",
    closesOn: "2026-10-31",
    status: "draft" as const,
    criteria: [{ ordinal: 1, kind: "skill" as const, requirement: "Clear written communication", isRequired: true }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mockPatrolRank();
  });

  it("uploads the image under the job, saves its path, and deletes the replaced image", async () => {
    const previous = "job-openings/42/0b8f2c1e-1111-4222-8333-944455556666.png";
    mocks.rpc.mockResolvedValueOnce({ data: { id: 42, image_path: previous }, error: null }).mockResolvedValueOnce({ data: previous, error: null });
    const file = new File(["image"], "poster.webp", { type: "image/webp" });

    const job = await saveJobOpening(values, 42, { file });

    const [objectPath] = mocks.upload.mock.calls[0];
    expect(objectPath).toMatch(/^job-openings\/42\/[0-9a-f-]{36}\.webp$/);
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_job_opening_image", { target_job_id: 42, target_image_path: objectPath });
    expect(mocks.remove).toHaveBeenCalledWith([previous]);
    expect(job.image_path).toBe(objectPath);
  });

  it("clears the saved image without uploading", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: 42 }, error: null }).mockResolvedValueOnce({ data: "job-openings/42/old.png", error: null });

    await saveJobOpening(values, 42, { remove: true });

    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_job_opening_image", { target_job_id: 42, target_image_path: null });
    expect(mocks.remove).toHaveBeenCalledWith(["job-openings/42/old.png"]);
  });
});

describe("signed-in checks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("explains an ended session instead of showing \"Auth session missing!\"", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: sessionMissing });

    await expect(saveApplicantProfile({ firstName: "Maria", lastName: "Reyes" })).rejects.toThrow(SESSION_ENDED_MESSAGE);
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
      saveApplicantProfileDocuments: (documents: { eligibility?: File; diploma?: File }) => Promise<void>;
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });

    expect(queries.saveApplicantProfileDocuments).toBeTypeOf("function");
    await expect(queries.saveApplicantProfileDocuments({
      eligibility: new File(["proof"], "eligibility.pdf", { type: "application/pdf" }),
    })).resolves.toBeUndefined();

    expect(mocks.upload).toHaveBeenCalledBefore(mocks.rpc);
    expect(mocks.rpc).toHaveBeenCalledWith("save_my_applicant_profile_document", expect.objectContaining({
      target_kind: "eligibility",
      target_file_name: "eligibility.pdf",
      target_mime_type: "application/pdf",
    }));
  });

  it("keeps already-persisted files when a later profile-document save fails", async () => {
    const queries = recruitmentQueries as typeof recruitmentQueries & {
      saveApplicantProfileDocuments: (documents: { eligibility?: File; diploma?: File }) => Promise<void>;
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("database write failed") });

    await expect(queries.saveApplicantProfileDocuments({
      eligibility: new File(["proof"], "eligibility.pdf", { type: "application/pdf" }),
      diploma: new File(["proof"], "diploma.pdf", { type: "application/pdf" }),
    })).rejects.toThrow("database write failed");

    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(mocks.remove.mock.calls[0]?.[0]).toHaveLength(1);
  });
});

describe("loadMyProfileDocumentFile", () => {
  beforeEach(() => vi.resetAllMocks());

  it("downloads the saved profile document as a File with its name and type", async () => {
    mocks.download.mockResolvedValue({ data: new Blob(["cv"], { type: "application/pdf" }), error: null });
    const file = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.pdf`, file_name: "resume.pdf", mime_type: "application/pdf" });
    expect(mocks.download).toHaveBeenCalledWith(`applicant-profiles/${userId}/a.pdf`);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("resume.pdf");
    expect(file.type).toBe("application/pdf");
  });

  it("keeps a legacy image CV usable", async () => {
    mocks.download.mockResolvedValue({ data: new Blob(["img"], { type: "image/png" }), error: null });
    const file = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.png`, file_name: "resume.png", mime_type: "image/png" });
    expect(file.type).toBe("image/png");
  });

  it("gives a saved file without an extension one that matches its type, so it can be attached", async () => {
    mocks.download.mockResolvedValue({ data: new Blob(["cv"], { type: "application/pdf" }), error: null });
    const file = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.pdf`, file_name: "Resume", mime_type: "application/pdf" });
    expect(file.name).toBe("Resume.pdf");
    const image = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.jpg`, file_name: "1000012345", mime_type: "image/jpeg" });
    expect(image.name).toBe("1000012345.jpg");
    const named = await loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.pdf`, file_name: "CV.PDF", mime_type: "application/pdf" });
    expect(named.name).toBe("CV.PDF");
  });

  it("explains a failed download in applicant terms", async () => {
    mocks.download.mockResolvedValue({ data: null, error: { message: "Object not found" } });
    await expect(loadMyProfileDocumentFile({ object_path: `applicant-profiles/${userId}/a.pdf`, file_name: "resume.pdf", mime_type: "application/pdf" })).rejects.toThrow("We could not attach your saved CV. Try again.");
  });
});
