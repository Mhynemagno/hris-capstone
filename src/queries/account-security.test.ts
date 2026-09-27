import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateUser: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ auth: { updateUser: mocks.updateUser }, rpc: mocks.rpc }) }));

import { changeMyPassword } from "./account-security";

describe("changeMyPassword", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }); });

  it("records a Password changed notification after the password is updated", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    await changeMyPassword("long-enough-password");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "long-enough-password" });
    expect(mocks.rpc).toHaveBeenCalledWith("record_password_changed");
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
  });

  it("does not record a notification when the password change fails", async () => {
    mocks.updateUser.mockResolvedValue({ error: { message: "Password is too weak." } });
    await expect(changeMyPassword("long-enough-password")).rejects.toThrow("Password is too weak.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("still succeeds when the notification cannot be recorded", async () => {
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.rpc.mockRejectedValue(new Error("offline"));
    await expect(changeMyPassword("long-enough-password")).resolves.toBeUndefined();
  });
});
