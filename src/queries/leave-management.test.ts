import { beforeEach, describe, expect, it, vi } from "vitest";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const userId = "123e4567-e89b-42d3-a456-426614174001";
const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const mocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getUser: mocks.authGetUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  }),
}));

import { leaveRequestFilters, submitLeaveRequest } from "./leave-management";

describe("leave management queries", () => {
  beforeEach(() => vi.resetAllMocks());

  it("normalizes HR queue filters before a request is made", () => {
    expect(leaveRequestFilters({ page: "2", pageSize: "200", search: "  leave  " })).toEqual({
      page: 2,
      pageSize: 100,
      search: "leave",
    });
  });

  it("removes uploaded evidence when the request RPC fails", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.storageFrom.mockReturnValue({ remove, upload });
    mocks.rpc.mockResolvedValue({ error: { message: "request rejected" } });

    await expect(submitLeaveRequest({
      requestId,
      leaveTypeId: requestId,
      startsOn: futureDate,
      endsOn: futureDate,
      reason: "Medical appointment",
    }, [new File(["evidence"], "evidence.pdf", { type: "application/pdf" })])).rejects.toThrow("request rejected");

    expect(remove).toHaveBeenCalledWith([expect.stringMatching(new RegExp(`^leave-requests/${userId}/${requestId}/`))]);
  });
});
