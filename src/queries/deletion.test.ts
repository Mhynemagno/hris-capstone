import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, deleteManagedUser } = vi.hoisted(() => ({ rpc: vi.fn(), deleteManagedUser: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc }) }));
vi.mock("@/queries/administration", () => ({ deleteManagedUser }));

import { deleteRecord, getDeletionImpact } from "./deletion";

describe("deletion queries", () => {
  beforeEach(() => {
    rpc.mockReset();
    deleteManagedUser.mockReset();
  });

  it("asks the database for the impact preview and normalises empty lists", async () => {
    rpc.mockResolvedValue({ data: { entityType: "job_opening", entityId: "4", label: "Investigator", canDelete: true }, error: null });

    await expect(getDeletionImpact("job_opening", 4)).resolves.toMatchObject({ blockers: [], reasons: [], removes: [], alternative: null });
    expect(rpc).toHaveBeenCalledWith("get_deletion_impact", { entity_type: "job_opening", entity_id: "4" });
  });

  it("routes each record type to its guarded delete RPC with the right identifier type", async () => {
    rpc.mockResolvedValue({ error: null });

    await deleteRecord("leave_type", "00000000-0000-4000-8000-000000000001");
    await deleteRecord("job_opening", "3");

    expect(rpc).toHaveBeenNthCalledWith(1, "delete_leave_type", { target_leave_type_id: "00000000-0000-4000-8000-000000000001" });
    expect(rpc).toHaveBeenNthCalledWith(2, "delete_draft_job_opening", { target_job_id: 3 });
  });

  it("deletes accounts through the audited Edge Function, not a direct RPC", async () => {
    await deleteRecord("managed_user", "00000000-0000-4000-8000-000000000009");

    expect(deleteManagedUser).toHaveBeenCalledWith({ userId: "00000000-0000-4000-8000-000000000009" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces the database explanation when a delete is blocked", async () => {
    rpc.mockResolvedValue({ error: { message: "Vacation cannot be deleted. It is still used by 3 leave requests." } });

    await expect(deleteRecord("leave_type", "00000000-0000-4000-8000-000000000001")).rejects.toThrow("It is still used by 3 leave requests.");
  });
});
