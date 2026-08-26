import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const applicationId = "223e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload }) },
  }),
}));

import { submitApplication } from "./recruitment";

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
});
