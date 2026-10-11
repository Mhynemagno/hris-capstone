import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ status: "pending" as string | null }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.status ? { status: mocks.status } : null, error: null }) }) }) }),
  }),
}));

import HrLeaveRequestPage from "./page";

const params = (requestId: string) => ({ params: Promise.resolve({ requestId }) });

describe("old leave request links open the in-place modals", () => {
  it("opens the review for a pending request", async () => {
    mocks.status = "pending";
    await expect(HrLeaveRequestPage(params("r1"))).rejects.toThrow("REDIRECT /hr/leave-requests?review=r1");
  });

  it("opens the details for a decided request", async () => {
    mocks.status = "approved";
    await expect(HrLeaveRequestPage(params("r2"))).rejects.toThrow("REDIRECT /hr/leave-requests?view=r2");
  });

  it("lets the details modal explain a missing request", async () => {
    mocks.status = null;
    await expect(HrLeaveRequestPage(params("r3"))).rejects.toThrow("REDIRECT /hr/leave-requests?view=r3");
  });
});
