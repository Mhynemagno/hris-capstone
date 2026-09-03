import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const storageFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ rpc, storage: { from: storageFrom } }),
}));

import { getEmployeeProfilePhotoUrl, listUnlinkedEmployeeAccounts, replaceMyEmployeeProfilePhoto } from "./personnel-records";

const employee = {
  id: "00000000-0000-0000-0000-000000000010",
  profile_id: "00000000-0000-0000-0000-000000000004",
  profile_image_path: "employees/00000000-0000-0000-0000-000000000010/123e4567-e89b-42d3-a456-826614174000.png",
} as const;

describe("personnel-record queries", () => {
  beforeEach(() => {
    rpc.mockReset();
    storageFrom.mockReset();
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

  it("creates a short-lived URL for a private profile photo", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.test/profile" }, error: null });
    storageFrom.mockReturnValue({ createSignedUrl });

    await expect(getEmployeeProfilePhotoUrl(employee.profile_image_path)).resolves.toBe("https://example.test/profile");
    expect(storageFrom).toHaveBeenCalledWith("employee-profile-photos");
    expect(createSignedUrl).toHaveBeenCalledWith(employee.profile_image_path, 60);
  });

  it("uploads before changing the path and removes the previous photo after success", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    storageFrom.mockReturnValue({ upload, remove });
    rpc.mockResolvedValue({ error: null });

    await expect(replaceMyEmployeeProfilePhoto(employee, new File(["photo"], "officer.webp", { type: "image/webp" }))).resolves.toMatchObject({ path: expect.stringMatching(/^employees\/00000000-0000-0000-0000-000000000010\//), cleanupError: null });
    expect(upload).toHaveBeenCalledBefore(rpc);
    expect(rpc).toHaveBeenCalledBefore(remove);
    expect(remove).toHaveBeenCalledWith([employee.profile_image_path]);
  });
});
