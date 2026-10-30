import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentRole } from "./current-role";

const { createServerSupabaseClient, getVerifiedUserId } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getVerifiedUserId: vi.fn(),
}));

vi.mock("./current-user", () => ({ getVerifiedUserId }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient,
}));

describe("getCurrentRole", () => {
  beforeEach(() => {
    getVerifiedUserId.mockReset();
    createServerSupabaseClient.mockReset();
  });

  it("returns null without a verified user", async () => {
    getVerifiedUserId.mockResolvedValue(null);

    await expect(getCurrentRole()).resolves.toBeNull();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns only a valid application role from the role record", async () => {
    getVerifiedUserId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { role: "hr_personnel" },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createServerSupabaseClient.mockResolvedValue({ from, rpc: vi.fn().mockResolvedValue({ data: true, error: null }) });

    await expect(getCurrentRole()).resolves.toBe("hr_personnel");
    expect(eq).toHaveBeenCalledWith(
      "user_id",
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("returns null when the database value is not an application role", async () => {
    getVerifiedUserId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { role: "superuser" },
      error: null,
    });
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
    });

    await expect(getCurrentRole()).resolves.toBeNull();
  });

  it("returns null when the database access decision denies the account", async () => {
    getVerifiedUserId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      from: vi.fn(),
    });

    await expect(getCurrentRole()).resolves.toBeNull();
  });

  it("returns null while the applicant cooling-off period still blocks access", async () => {
    getVerifiedUserId.mockResolvedValue("00000000-0000-4000-8000-000000000001");
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { role: "applicant" },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    createServerSupabaseClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      }),
      rpc,
    });

    await expect(getCurrentRole()).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith("current_account_can_sign_in");
  });
});
