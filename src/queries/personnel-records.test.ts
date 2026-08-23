import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc }),
}));

import { listUnlinkedEmployeeAccounts } from "./personnel-records";

describe("personnel-record queries", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("returns only the typed account candidates supplied by the protected HR RPC", async () => {
    rpc.mockResolvedValue({
      data: [{
        profile_id: "00000000-0000-4000-8000-000000001604",
        first_name: "Ariun",
        last_name: "Bold",
        full_name: "Ariun Bold",
        email: "candidate.employee@example.test",
      }],
      error: null,
    });

    await expect(listUnlinkedEmployeeAccounts()).resolves.toEqual([{
      profile_id: "00000000-0000-4000-8000-000000001604",
      first_name: "Ariun",
      last_name: "Bold",
      full_name: "Ariun Bold",
      email: "candidate.employee@example.test",
    }]);
    expect(rpc).toHaveBeenCalledWith("list_unlinked_employee_accounts");
  });
});
