import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const storageFrom = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from, rpc, storage: { from: storageFrom } }),
}));

import { deletePersonnelEntry, getEmployeeProfilePhotoUrl, listUnlinkedEmployeeAccounts, replaceMyEmployeeProfilePhoto, saveEmployee } from "./personnel-records";

const employee = {
  id: "00000000-0000-0000-0000-000000000010",
  profile_id: "00000000-0000-0000-0000-000000000004",
  profile_image_path: "employees/00000000-0000-0000-0000-000000000010/123e4567-e89b-42d3-a456-826614174000.png",
} as const;

describe("personnel-record queries", () => {
  beforeEach(() => {
    rpc.mockReset();
    storageFrom.mockReset();
    from.mockReset();
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

  describe("saveEmployee", () => {
    const employeeId = "00000000-0000-4000-8000-000000000010";
    const baseInput = {
      employeeNumber: "1-00001",
      firstName: "Ana",
      lastName: "Reyes",
      personalEmail: "ana@example.test",
      employmentStatus: "active" as const,
      employmentStartedOn: "2024-01-01",
    };

    function mockTable() {
      const single = vi.fn().mockResolvedValue({ data: { id: employeeId }, error: null });
      const select = vi.fn(() => ({ single }));
      const eq = vi.fn(() => ({ select }));
      const update = vi.fn<(values: Record<string, unknown>) => { eq: typeof eq }>(() => ({ eq }));
      const insert = vi.fn<(values: Record<string, unknown>) => { select: typeof select }>(() => ({ select }));
      from.mockReturnValue({ update, insert });
      return { update, insert, eq };
    }

    it("keeps department and rank on edit and never sends profile_id when no link is supplied", async () => {
      const table = mockTable();

      await saveEmployee({ ...baseInput, departmentId: 3, rankId: 7 }, employeeId);

      expect(from).toHaveBeenCalledWith("employees");
      expect(table.eq).toHaveBeenCalledWith("id", employeeId);
      const values = table.update.mock.calls[0]![0];
      expect(values).toMatchObject({ department_id: 3, rank_id: 7 });
      expect(values).not.toHaveProperty("profile_id");
    });

    it("re-sends the linked account on edit when the form supplies it", async () => {
      const table = mockTable();
      const profileId = "00000000-0000-4000-8000-000000001604";

      await saveEmployee({ ...baseInput, profileId, departmentId: 3, rankId: 7 }, employeeId);

      expect(table.update.mock.calls[0]![0]).toMatchObject({ profile_id: profileId, department_id: 3, rank_id: 7 });
    });

    it("stores an explicit null link when creating an unlinked record", async () => {
      const table = mockTable();

      await saveEmployee(baseInput);

      expect(table.insert.mock.calls[0]![0]).toMatchObject({ profile_id: null, department_id: null, rank_id: null });
    });
  });

  it("explains when a qualification cannot be deleted because promotion evidence uses it", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { code: "23503", message: "violates foreign key constraint" } });
    from.mockReturnValue({ delete: () => ({ eq }) });

    await expect(deletePersonnelEntry("qualification", "00000000-0000-4000-8000-000000000001")).rejects.toThrow(/used as evidence in a promotion evaluation/);
    expect(from).toHaveBeenCalledWith("qualifications");
  });

  it("never deletes official service history", async () => {
    await expect(deletePersonnelEntry("serviceHistory", "00000000-0000-4000-8000-000000000001")).rejects.toThrow(/cannot be deleted/);
    expect(from).not.toHaveBeenCalled();
  });
});
