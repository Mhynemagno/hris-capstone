import { beforeEach, describe, expect, it, vi } from "vitest";

const testUserId = "123e4567-e89b-42d3-a456-426614174000";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  }),
}));

import {
  inviteInternalUser,
  listAuditLogs,
  listManagedUsers,
  saveOrganizationSettings,
  savePosition,
  updateManagedUser,
} from "./administration";

type Result = { data: unknown; error: { message: string } | null; count?: number | null };

function createChain(result: Result) {
  const chain = {
    eq: vi.fn(),
    in: vi.fn(),
    ilike: vi.fn(),
    insert: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };
  Object.values(chain).forEach((method) => method.mockReturnValue(chain));
  chain.in.mockResolvedValue(result);
  chain.range.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

describe("administration queries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a flat managed-user page and requests only its 20-row range", async () => {
    const profileChain = createChain({
      data: [{
        id: testUserId,
        email: "ada@example.com",
        full_name: "Ada Lovelace",
        is_active: true,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      }],
      count: 21,
      error: null,
    });
    const roleChain = createChain({
      data: [{ user_id: testUserId, role: "employee", assigned_at: "2026-08-01T00:00:00.000Z" }],
      error: null,
    });
    mocks.from.mockReturnValueOnce(profileChain).mockReturnValueOnce(roleChain);

    const page = await listManagedUsers({ page: 2, pageSize: 20, search: "Ada", role: "employee" });

    expect(page).toEqual({
      rows: [{
        id: testUserId,
        email: "ada@example.com",
        full_name: "Ada Lovelace",
        is_active: true,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        role: "employee",
        assigned_at: "2026-08-01T00:00:00.000Z",
      }],
      count: 21,
      filters: { page: 2, pageSize: 20, search: "Ada", role: "employee" },
    });
    expect(profileChain.range).toHaveBeenCalledWith(20, 39);
    expect(roleChain.eq).toHaveBeenCalledWith("role", "employee");
    expect(roleChain.in).toHaveBeenCalledWith("user_id", [testUserId]);
  });

  it("composes managed users from a bounded profile page and roles constrained to that page", async () => {
    const profileChain = createChain({
      data: [{
        id: testUserId,
        email: "ada@example.com",
        full_name: "Ada Lovelace",
        is_active: true,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      }],
      count: 21,
      error: null,
    });
    const roleChain = createChain({
      data: [{ user_id: testUserId, role: "employee", assigned_at: "2026-08-01T00:00:00.000Z" }],
      error: null,
    });
    mocks.from.mockReturnValueOnce(profileChain).mockReturnValueOnce(roleChain);

    await listManagedUsers({ page: 2, pageSize: 20 });

    expect(profileChain.range).toHaveBeenCalledWith(20, 39);
    expect(profileChain.select).not.toHaveBeenCalledWith(expect.stringContaining("user_roles!"));
    expect(roleChain.in).toHaveBeenCalledWith("user_id", [testUserId]);
  });

  it("enriches a 20-row audit page with only the profiles referenced by that page", async () => {
    const targetUserId = "223e4567-e89b-42d3-a456-426614174000";
    const auditChain = createChain({
      data: [{
        id: 1,
        actor_user_id: testUserId,
        entity_type: "user_roles",
        entity_id: targetUserId,
        action: "update",
        metadata: { user_id: targetUserId, role: "system_administrator" },
        created_at: "2026-08-15T09:18:40.330063+00:00",
      }],
      count: 1,
      error: null,
    });
    const profileChain = createChain({
      data: [
        { id: testUserId, full_name: "Chief Ada Lovelace", email: "ada@example.com" },
        { id: targetUserId, full_name: "Officer Grace Hopper", email: "grace@example.com" },
      ],
      error: null,
    });
    mocks.from.mockReturnValueOnce(auditChain).mockReturnValueOnce(profileChain);

    const page = await listAuditLogs({ page: 1, pageSize: 20 });

    expect(auditChain.range).toHaveBeenCalledWith(0, 19);
    expect(profileChain.in).toHaveBeenCalledWith("id", [testUserId, targetUserId]);
    expect(page.rows[0]).toMatchObject({
      actorLabel: "Chief Ada Lovelace",
      recordLabel: "Account “Officer Grace Hopper”",
      actionLabel: "Role changed to System Administrator",
    });
  });

  it("sends name parts only to the protected invitation workflow", async () => {
    mocks.invoke.mockResolvedValue({ data: { userId: testUserId }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(inviteInternalUser({ email: "new@example.com", firstName: "New", lastName: "User", fullName: "New User", role: "employee" })).resolves.toEqual({ userId: testUserId });
    await expect(updateManagedUser({ userId: testUserId, role: "management", isActive: false })).resolves.toBeUndefined();

    expect(mocks.invoke).toHaveBeenCalledWith("invite-internal-user", {
      body: { email: "new@example.com", firstName: "New", lastName: "User", role: "employee" },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("update_managed_user", {
      target_user_id: testUserId,
      next_role: "management",
      next_is_active: false,
    });
  });

  it("surfaces the safe Edge Function error body for invitations", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Failed to send a request to the Edge Function",
        context: { json: vi.fn().mockResolvedValue({ error: "Administrator access is required." }) },
      },
    });

    await expect(inviteInternalUser({ email: "new@example.com", firstName: "New", lastName: "User", fullName: "New User", role: "employee" }))
      .rejects.toThrow("Administrator access is required.");
  });

  it("serializes position and organization settings fields for RLS-protected writes", async () => {
    const chain = createChain({ data: { id: 1 }, error: null });
    mocks.from.mockReturnValue(chain);

    await savePosition({ departmentId: 3, title: "Engineer", code: "ENG", description: "Builds systems", isActive: true });
    await saveOrganizationSettings({ organizationName: "HRIS", supportEmail: "support@example.com", defaultTimezone: "Asia/Ulaanbaatar" });

    expect(chain.insert).toHaveBeenCalledWith({
      department_id: 3,
      title: "Engineer",
      code: "ENG",
      description: "Builds systems",
      is_active: true,
    });
    expect(chain.upsert).toHaveBeenCalledWith({
      id: true,
      organization_name: "HRIS",
      support_email: "support@example.com",
      default_timezone: "Asia/Ulaanbaatar",
    });
  });
});
