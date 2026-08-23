import { beforeEach, describe, expect, it, vi } from "vitest";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174001";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), authGetUser: vi.fn(), storageFrom: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { getUser: mocks.authGetUser },
    storage: { from: mocks.storageFrom },
  }),
}));

import { cancelProfileChangeRequest, decideProfileChangeRequest, getProfileChangeDocumentUrl, submitProfileChangeRequest } from "./profile-change-requests";

describe("profile change request queries", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uploads validated supporting files then submits only the normalized request payload", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.storageFrom.mockReturnValue({ upload });
    mocks.rpc.mockResolvedValue({ error: null });
    const file = new File(["evidence"], "evidence.pdf", { type: "application/pdf" });

    await submitProfileChangeRequest({ requestId, changes: [{ kind: "contact", field: "phone", originalValue: null, requestedValue: "+976 99112233" }] }, [file]);

    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^profile-change-requests/${userId}/${requestId}/`)), file, expect.objectContaining({ contentType: "application/pdf", upsert: false }));
    expect(mocks.rpc).toHaveBeenCalledWith("submit_profile_change_request", expect.objectContaining({ target_request_id: requestId, requested_documents: [expect.objectContaining({ fileName: "evidence.pdf", mimeType: "application/pdf" })] }));
  });

  it("sends only approved or rejected decisions through the decision RPC", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await decideProfileChangeRequest({ requestId, decision: "approved" });
    expect(mocks.rpc).toHaveBeenCalledWith("decide_profile_change_request", { target_request_id: requestId, requested_decision: "approved", requested_reason: null });
  });

  it("cancels through the protected cancellation RPC", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await cancelProfileChangeRequest({ requestId });
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_profile_change_request", { target_request_id: requestId });
  });

  it("creates a short-lived URL only for a profile-change evidence path", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.test/private" }, error: null });
    mocks.storageFrom.mockReturnValue({ createSignedUrl });
    await expect(getProfileChangeDocumentUrl(`profile-change-requests/${userId}/${requestId}/123e4567-e89b-42d3-a456-426614174002.pdf`)).resolves.toBe("https://example.test/private");
    expect(createSignedUrl).toHaveBeenCalledWith(expect.stringContaining(`/${requestId}/`), 60);
    await expect(getProfileChangeDocumentUrl("not-a-request-document.pdf")).rejects.toThrow("Invalid profile-change request document path");
  });
});
