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
    rpc.mockResolvedValue({ data: { entityType: "department", entityId: "4", label: "Operations", canDelete: true }, error: null });

    await expect(getDeletionImpact("department", 4)).resolves.toMatchObject({ blockers: [], reasons: [], removes: [], alternative: null });
    expect(rpc).toHaveBeenCalledWith("get_deletion_impact", { entity_type: "department", entity_id: "4" });
  });

  it("routes each record type to its guarded delete RPC with the right identifier type", async () => {
    rpc.mockResolvedValue({ error: null });

    await deleteRecord("position", "12");
    await deleteRecord("leave_type", "00000000-0000-4000-8000-000000000001");
    await deleteRecord("job_opening", 3);

    expect(rpc).toHaveBeenNthCalledWith(1, "delete_position", { target_position_id: 12 });
    expect(rpc).toHaveBeenNthCalledWith(2, "delete_leave_type", { target_leave_type_id: "00000000-0000-4000-8000-000000000001" });
    expect(rpc).toHaveBeenNthCalledWith(3, "delete_draft_job_opening", { target_job_id: 3 });
  });

  it("deletes accounts through the audited Edge Function, not a direct RPC", async () => {
    await deleteRecord("managed_user", "00000000-0000-4000-8000-000000000009");

    expect(deleteManagedUser).toHaveBeenCalledWith({ userId: "00000000-0000-4000-8000-000000000009" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces the database explanation when a delete is blocked", async () => {
    rpc.mockResolvedValue({ error: { message: "Operations cannot be deleted. It is still used by 3 positions." } });

    await expect(deleteRecord("department", 1)).rejects.toThrow("It is still used by 3 positions.");
  });
});
